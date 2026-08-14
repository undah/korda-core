/**
 * POST /api/outreach/send  { campaignId, limit? }
 *
 * Drains queued messages for a campaign and sends them through Resend.
 * Runs server-side so the Resend key and the Supabase service-role key never
 * reach the browser.
 *
 * Safety checks are re-run here, at send time, rather than trusted from
 * whatever the UI queued earlier — the queue may be minutes or hours old:
 *   • suppression_list (email or domain)
 *   • contacts.do_not_contact
 *   • already-sent guard (no duplicate sends to the same contact)
 *   • per-niche send_cap_per_day
 * Anything failing a check is marked `skipped` with a reason, never sent.
 *
 * Sends a small batch per invocation (CF has a request time limit); the UI
 * calls repeatedly until `remaining` is 0.
 */

const DEFAULT_BATCH = 25;

function sb(env, path, init = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function sbJson(env, path, init) {
  const res = await sb(env, path, init);
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function markMessage(env, id, patch) {
  await sb(env, `outreach_messages?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

/** Text → minimal HTML, so the unsubscribe link is clickable in the client. */
function toHtml(text, unsubUrl) {
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#222">
${escaped}
<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0 12px">
<p style="font-size:12px;color:#888;margin:0">
  Don't want to hear from me again? <a href="${unsubUrl}" style="color:#888">Unsubscribe</a>.
</p>
</div>`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  for (const key of ['RESEND_API_KEY', 'OUTREACH_FROM', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!env[key]) return Response.json({ error: `${key} not configured` }, { status: 500 });
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { campaignId, limit } = body;
  if (!campaignId) return Response.json({ error: 'campaignId is required' }, { status: 400 });

  const batchSize = Math.min(Number(limit) || DEFAULT_BATCH, 50);
  const origin = new URL(request.url).origin;

  try {
    const queued = await sbJson(
      env,
      `outreach_messages?campaign_id=eq.${campaignId}&status=eq.queued&select=*&order=created_at.asc&limit=${batchSize}`,
    );

    if (!queued.length) {
      await sb(env, `campaigns?id=eq.${campaignId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'sent' }),
      });
      return Response.json({ sent: 0, skipped: 0, failed: 0, remaining: 0, done: true });
    }

    // Suppression list is small; pull it once for the batch.
    const suppressed = await sbJson(env, 'suppression_list?select=email,domain');
    const supEmails = new Set(suppressed.map(s => (s.email || '').toLowerCase()).filter(Boolean));
    const supDomains = new Set(suppressed.map(s => (s.domain || '').toLowerCase()).filter(Boolean));

    let sent = 0, skipped = 0, failed = 0;
    // Addresses sent during this invocation, so duplicates inside one batch are
    // caught without re-querying for a row we only just wrote.
    const sentAddresses = new Set();

    for (const msg of queued) {
      const email = (msg.to_email || '').toLowerCase();
      const domain = email.split('@')[1] || '';

      // ── guard: suppression ──
      if (supEmails.has(email) || supDomains.has(domain)) {
        await markMessage(env, msg.id, { status: 'skipped', skip_reason: 'suppressed' });
        skipped++;
        continue;
      }

      // ── guard: do-not-contact + niche cap lookup ──
      const contacts = await sbJson(
        env,
        `contacts?id=eq.${msg.contact_id}&select=do_not_contact,business_id,businesses(niche_id,niches(send_cap_per_day,slug))`,
      );
      const contact = contacts[0];
      if (!contact) {
        await markMessage(env, msg.id, { status: 'skipped', skip_reason: 'contact deleted' });
        skipped++;
        continue;
      }
      if (contact.do_not_contact) {
        await markMessage(env, msg.id, { status: 'skipped', skip_reason: 'do-not-contact' });
        skipped++;
        continue;
      }

      // ── guard: never send twice to the same contact ──
      const priorSent = await sbJson(
        env,
        `outreach_events?contact_id=eq.${msg.contact_id}&event_type=eq.sent&select=id&limit=1`,
      );
      if (priorSent.length) {
        await markMessage(env, msg.id, { status: 'skipped', skip_reason: 'already contacted' });
        skipped++;
        continue;
      }

      // ── guard: never send twice to the same address ──
      // The contact check above is not enough: Places lists some companies as
      // two separate places, so two distinct contact rows can carry the same
      // address and each would pass its own already-sent check.
      if (sentAddresses.has(email)) {
        await markMessage(env, msg.id, { status: 'skipped', skip_reason: 'duplicate address in batch' });
        skipped++;
        continue;
      }
      const priorToAddress = await sbJson(
        env,
        `outreach_messages?to_email=ilike.${encodeURIComponent(msg.to_email)}&status=eq.sent&select=id&limit=1`,
      );
      if (priorToAddress.length) {
        await markMessage(env, msg.id, { status: 'skipped', skip_reason: 'address already contacted' });
        skipped++;
        continue;
      }

      // ── guard: per-niche daily cap ──
      const cap = contact.businesses?.niches?.send_cap_per_day ?? null;
      if (cap) {
        const since = new Date(); since.setHours(0, 0, 0, 0);
        const todays = await sbJson(
          env,
          `outreach_messages?status=eq.sent&sent_at=gte.${since.toISOString()}&select=id`,
        );
        if (todays.length >= cap) {
          await markMessage(env, msg.id, { status: 'skipped', skip_reason: `daily cap (${cap}) reached` });
          skipped++;
          continue;
        }
      }

      // ── send ──
      const unsubUrl = `${origin}/api/outreach/unsubscribe?t=${msg.unsubscribe_token}`;
      await markMessage(env, msg.id, { status: 'sending' });

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.OUTREACH_FROM,
          to: [msg.to_email],
          subject: msg.subject,
          text: `${msg.body}\n\n—\nDon't want to hear from me again? Unsubscribe: ${unsubUrl}`,
          html: toHtml(msg.body, unsubUrl),
          headers: { 'List-Unsubscribe': `<${unsubUrl}>` },
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        await markMessage(env, msg.id, { status: 'failed', error: `Resend ${res.status}: ${detail}`.slice(0, 500) });
        failed++;
        continue;
      }

      const data = await res.json().catch(() => ({}));
      const now = new Date().toISOString();
      await markMessage(env, msg.id, { status: 'sent', sent_at: now, provider_message_id: data.id ?? null });
      await sb(env, 'outreach_events', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          contact_id: msg.contact_id,
          campaign: campaignId,
          event_type: 'sent',
          meta: { provider_message_id: data.id ?? null },
        }),
      });
      sentAddresses.add(email);
      sent++;
    }

    const stillQueued = await sbJson(
      env,
      `outreach_messages?campaign_id=eq.${campaignId}&status=eq.queued&select=id`,
    );
    const remaining = stillQueued.length;

    await sb(env, `campaigns?id=eq.${campaignId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: remaining > 0 ? 'sending' : 'sent' }),
    });

    return Response.json({ sent, skipped, failed, remaining, done: remaining === 0 });
  } catch (e) {
    return Response.json({ error: e?.message ?? 'Send failed' }, { status: 500 });
  }
}
