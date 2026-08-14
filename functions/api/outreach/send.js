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

/*
 * ── sending adapters ────────────────────────────────────────────────────────
 *
 * Deliberately inlined rather than imported from a sibling module. Cloudflare
 * Pages treats files under functions/ as routes and special-cases the `_`
 * prefix, and a shared `_providers.js` here coincided with every function in
 * the project going dead — bare 404/405/500s with no body, which is the static
 * handler answering, not our code. Not worth the risk for one import.
 *
 * The shape still keeps the vendor swappable, which matters: Resend's
 * Acceptable Use Policy bans "cold outreach, purchased lists, or scraped
 * contact data" and requires recipients to have "explicitly opted in" — so a
 * system built on scraped leads has to be able to move providers without the
 * send path being rewritten around it.
 *
 * SMTP cannot live here at all: Workers cannot open raw TCP sockets. Moving to
 * SMTP mailboxes means relocating this loop to the pipeline host, which already
 * runs the scheduler. The interface below is transport-agnostic so that is a
 * relocation rather than a rewrite.
 */

function formatFrom(mail) {
  return mail.fromName ? `${mail.fromName} <${mail.from}>` : mail.from;
}

async function sendViaResend(mail, credential) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: formatFrom(mail),
      to: [mail.to],
      reply_to: mail.replyTo || undefined,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      headers: mail.headers,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  }
  const data = await res.json().catch(() => ({}));
  return { id: data.id ?? null };
}

/**
 * Generic JSON-over-HTTP adapter for vendors that permit cold outreach.
 * Configured by env so a new vendor needs no code change:
 *   OUTREACH_HTTP_ENDPOINT, OUTREACH_HTTP_AUTH_STYLE (bearer|header|query),
 *   OUTREACH_HTTP_AUTH_NAME
 */
async function sendViaHttp(mail, credential, env) {
  if (!env.OUTREACH_HTTP_ENDPOINT) throw new Error('OUTREACH_HTTP_ENDPOINT is not configured');

  const style = env.OUTREACH_HTTP_AUTH_STYLE ?? 'bearer';
  const name = env.OUTREACH_HTTP_AUTH_NAME ?? 'Authorization';
  const url = new URL(env.OUTREACH_HTTP_ENDPOINT);
  const headers = { 'Content-Type': 'application/json' };

  if (style === 'query') url.searchParams.set(name, credential);
  else if (style === 'header') headers[name] = credential;
  else headers.Authorization = `Bearer ${credential}`;

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: mail.from, from_name: mail.fromName ?? undefined, to: mail.to,
      reply_to: mail.replyTo || undefined, subject: mail.subject,
      text: mail.text, html: mail.html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Provider ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  }
  const data = await res.json().catch(() => ({}));
  return { id: data.id ?? data.message_id ?? data.messageId ?? null };
}

const ADAPTERS = { resend: sendViaResend, http: sendViaHttp };

async function sendMail(provider, mail, credential, env) {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`Unknown sending provider "${provider}"`);
  if (!credential) throw new Error(`No credential configured for provider "${provider}"`);
  return adapter(mail, credential, env);
}

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

const TZ = 'Europe/Amsterdam';

/** How far the given zone is ahead of UTC at that instant, in ms. */
export function zoneOffsetMs(date, timeZone = TZ) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});

  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Start of today in Amsterdam, as an ISO instant. Counting "today" from UTC
 * midnight would be wrong for the first one or two hours of every local day.
 * Resolved twice because the offset can differ either side of local midnight —
 * on the two DST changeover days a single pass lands an hour out.
 */
export function amsterdamMidnight(now = new Date(), timeZone = TZ) {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now).split('-').map(Number);

  let instant = Date.UTC(y, m - 1, d);
  for (let i = 0; i < 2; i++) {
    instant = Date.UTC(y, m - 1, d) - zoneOffsetMs(new Date(instant), timeZone);
  }
  return new Date(instant).toISOString();
}

/**
 * A brand-new sending domain has no reputation, and volume from a cold domain
 * is the classic spam signal. When OUTREACH_WARMUP_START is set we ramp from 5
 * a day, adding 5 a week, never exceeding the niche's own cap. Unset means the
 * niche cap applies as-is.
 */
/**
 * How many a single mailbox may send today.
 *
 * Its own cap, ramped if it is still warming. 30-50/day is the accepted safe
 * band for cold sending per mailbox, and a brand-new mailbox that opens at its
 * full cap lands in spam: properly warmed accounts see far better inbox
 * placement than cold-started ones, and the ramp is what earns that.
 */
export function identityCapToday(identity, now = Date.now()) {
  const cap = identity.daily_cap ?? 40;
  if (!identity.warmup_started_on) return cap;

  const started = Date.parse(identity.warmup_started_on);
  if (Number.isNaN(started)) return cap;

  const weeks = Math.floor((now - started) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(cap, 5 + 5 * Math.max(0, weeks));
}

/**
 * Pick the mailbox with the most headroom left today.
 *
 * Most-headroom rather than round-robin so volume self-levels across a pool
 * whose members have different caps and warm-up ages, instead of the smallest
 * mailbox becoming the bottleneck for everyone.
 */
export function pickIdentity(identities, sentToday, now = Date.now()) {
  const usable = identities
    .filter(i => i.active)
    .map(i => ({ identity: i, headroom: identityCapToday(i, now) - (sentToday[i.id] ?? 0) }))
    .filter(x => x.headroom > 0)
    .sort((a, b) => b.headroom - a.headroom);

  return usable[0]?.identity ?? null;
}

export function warmupCap(env, nicheCap, now = Date.now()) {
  if (!env.OUTREACH_WARMUP_START) return nicheCap;
  const started = Date.parse(env.OUTREACH_WARMUP_START);
  if (Number.isNaN(started)) return nicheCap;

  const weeks = Math.floor((now - started) / (7 * 24 * 60 * 60 * 1000));
  const ramp = 5 + 5 * Math.max(0, weeks);
  return nicheCap === null ? ramp : Math.min(nicheCap, ramp);
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

  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!env[key]) return Response.json({ error: `${key} not configured` }, { status: 500 });
  }
  // RESEND_API_KEY / OUTREACH_FROM are only required as the fallback for an
  // empty identity pool; a pool-only setup supplies its own per-identity
  // credentials, so demanding them here would break that configuration.

  // Only the scheduler may drain the queue. Sending is paced deliberately, and
  // an endpoint anyone could POST to would let a caller bypass that pacing —
  // the one mistake that burns a sending domain. Fails closed, like /run.
  if (!env.SEND_TRIGGER_SECRET) {
    return Response.json({ error: 'SEND_TRIGGER_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('x-send-secret') !== env.SEND_TRIGGER_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { campaignId, limit } = body;
  if (!campaignId) return Response.json({ error: 'campaignId is required' }, { status: 400 });

  const batchSize = Math.min(Number(limit) || DEFAULT_BATCH, 50);
  const origin = new URL(request.url).origin;

  try {
    // Only work that is actually due. A null scheduled_at means "a later step
    // whose turn has not come" — it is activated when the step before it sends.
    const nowIso = new Date().toISOString();
    const queued = await sbJson(
      env,
      `outreach_messages?campaign_id=eq.${campaignId}&status=eq.queued` +
        `&scheduled_at=not.is.null&scheduled_at=lte.${nowIso}` +
        `&select=*&order=scheduled_at.asc&limit=${batchSize}`,
    );

    if (!queued.length) {
      // Nothing due now is not the same as nothing left: a campaign mid-sequence
      // is waiting, not finished. Only close it when no queued work remains at
      // all, otherwise it would flip to 'sent' between steps and the scheduler
      // would stop picking it up.
      const outstanding = await sbJson(
        env,
        `outreach_messages?campaign_id=eq.${campaignId}&status=eq.queued&select=id&limit=1`,
      );
      if (!outstanding.length) {
        await sb(env, `campaigns?id=eq.${campaignId}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'sent' }),
        });
      }
      return Response.json({
        sent: 0, skipped: 0, failed: 0,
        remaining: outstanding.length,
        done: outstanding.length === 0,
      });
    }

    // Steps for this campaign, pulled once — used to schedule the follow-up
    // after each successful send.
    const steps = await sbJson(
      env,
      `sequence_steps?campaign_id=eq.${campaignId}&select=step_number,delay_days&order=step_number.asc`,
    );

    // ── the sending pool ──
    // An empty pool falls back to the original single-sender env pair, so this
    // stays a no-op until identities are actually configured.
    const identities = await sbJson(
      env, 'sending_identities?select=*&active=is.true&order=created_at.asc',
    );
    const since = amsterdamMidnight();
    const sentToday = {};
    if (identities.length) {
      const todaysByIdentity = await sbJson(
        env,
        `outreach_messages?status=eq.sent&sent_at=gte.${since}&identity_id=not.is.null&select=identity_id`,
      );
      for (const row of todaysByIdentity) {
        sentToday[row.identity_id] = (sentToday[row.identity_id] ?? 0) + 1;
      }
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

      // ── guard: this contact has replied ──
      // The inbound handler cancels remaining steps on reply; this is the
      // backstop for a reply that arrived while a batch was already in flight.
      const replied = await sbJson(
        env,
        `outreach_events?contact_id=eq.${msg.contact_id}&event_type=eq.replied&select=id&limit=1`,
      );
      if (replied.length) {
        await markMessage(env, msg.id, { status: 'canceled', skip_reason: 'replied' });
        skipped++;
        continue;
      }

      // ── guard: never contact someone from two campaigns at once ──
      // Scoped to *other* campaigns. Within this campaign a follow-up is the
      // entire point, so a prior send here must not block the next step.
      const priorOther = await sbJson(
        env,
        `outreach_messages?contact_id=eq.${msg.contact_id}&status=eq.sent` +
          `&campaign_id=neq.${campaignId}&select=id&limit=1`,
      );
      if (priorOther.length) {
        await markMessage(env, msg.id, {
          status: 'skipped',
          skip_reason: 'contacted by another campaign',
        });
        skipped++;
        continue;
      }

      // ── guard: never send twice to the same address ──
      // The contact check above is not enough: Places lists some companies as
      // two separate places, so two distinct contact rows can carry the same
      // address and each would pass its own check. Also scoped to other
      // campaigns, for the same reason as above.
      if (sentAddresses.has(email)) {
        await markMessage(env, msg.id, { status: 'skipped', skip_reason: 'duplicate address in batch' });
        skipped++;
        continue;
      }
      const priorToAddress = await sbJson(
        env,
        `outreach_messages?to_email=ilike.${encodeURIComponent(msg.to_email)}&status=eq.sent` +
          `&campaign_id=neq.${campaignId}&select=id&limit=1`,
      );
      if (priorToAddress.length) {
        await markMessage(env, msg.id, { status: 'skipped', skip_reason: 'address already contacted' });
        skipped++;
        continue;
      }

      // ── guard: per-niche daily cap ──
      // Was counting every message sent today across all niches while comparing
      // against one niche's cap, so a busy niche starved the others. Counts are
      // now scoped to the niche, from Amsterdam midnight rather than UTC — at
      // 01:00 local in summer, UTC midnight is still yesterday.
      // Prefer the denormalised column; fall back to the join for any message
      // queued before that column existed.
      const nicheId = msg.niche_id ?? contact.businesses?.niche_id ?? null;
      const cap = warmupCap(env, contact.businesses?.niches?.send_cap_per_day ?? null);
      if (cap !== null && nicheId) {
        const todays = await sbJson(
          env,
          `outreach_messages?status=eq.sent&niche_id=eq.${nicheId}` +
            `&sent_at=gte.${since}&select=id`,
        );
        if (todays.length >= cap) {
          await markMessage(env, msg.id, { status: 'skipped', skip_reason: `daily cap (${cap}) reached` });
          skipped++;
          continue;
        }
      }

      // ── pick a mailbox ──
      // Per-mailbox caps are what make volume safe: one domain carries roughly
      // 100-150/day, so anything beyond that is a pool problem, not a pacing
      // problem. With no pool configured we fall back to the original single
      // sender so behaviour is unchanged until identities exist.
      const identity = identities.length ? pickIdentity(identities, sentToday) : null;
      if (identities.length && !identity) {
        // Every mailbox is at its ceiling. Leave the message queued — the next
        // tick, or tomorrow, will have headroom.
        break;
      }

      const provider = identity?.provider ?? 'resend';
      const credential = identity
        ? env[identity.credential_key]
        : env.RESEND_API_KEY;
      const fromEmail = identity?.from_email ?? env.OUTREACH_FROM;

      if (!credential) {
        await markMessage(env, msg.id, {
          status: 'failed',
          error: `No credential in env "${identity?.credential_key ?? 'RESEND_API_KEY'}"`,
        });
        failed++;
        continue;
      }

      // ── send ──
      const unsubUrl = `${origin}/api/outreach/unsubscribe?t=${msg.unsubscribe_token}`;
      await markMessage(env, msg.id, { status: 'sending' });

      let result;
      try {
        result = await sendMail(provider, {
          from: fromEmail,
          fromName: identity?.from_name ?? null,
          to: msg.to_email,
          replyTo: identity?.reply_to ?? null,
          subject: msg.subject,
          text: `${msg.body}\n\n—\nDon't want to hear from me again? Unsubscribe: ${unsubUrl}`,
          html: toHtml(msg.body, unsubUrl),
          headers: { 'List-Unsubscribe': `<${unsubUrl}>` },
        }, credential, env);
      } catch (e) {
        await markMessage(env, msg.id, {
          status: 'failed',
          error: (e?.message ?? 'Send failed').slice(0, 500),
        });
        failed++;
        continue;
      }

      const now = new Date().toISOString();
      await markMessage(env, msg.id, {
        status: 'sent',
        sent_at: now,
        provider_message_id: result.id ?? null,
        identity_id: identity?.id ?? null,
      });
      await sb(env, 'outreach_events', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          contact_id: msg.contact_id,
          campaign: campaignId,
          event_type: 'sent',
          meta: { provider_message_id: result.id ?? null, identity: identity?.label ?? null },
        }),
      });
      sentAddresses.add(email);
      if (identity) sentToday[identity.id] = (sentToday[identity.id] ?? 0) + 1;
      sent++;

      // ── activate the next step ──
      // Delays are measured from when this step actually sent, not from campaign
      // start, so a campaign paced over days keeps its intended spacing.
      const nextStep = steps.find(s => s.step_number === (msg.step_number ?? 1) + 1);
      if (nextStep) {
        const due = new Date(Date.now() + nextStep.delay_days * 24 * 60 * 60 * 1000);
        await sb(
          env,
          `outreach_messages?campaign_id=eq.${campaignId}&contact_id=eq.${msg.contact_id}` +
            `&step_number=eq.${nextStep.step_number}&status=eq.queued`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ scheduled_at: due.toISOString() }),
          },
        );
      }
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
