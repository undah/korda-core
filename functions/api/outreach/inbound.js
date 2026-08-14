/**
 * POST /api/outreach/inbound — Resend inbound (reply) receiver.
 *
 * Replies are the point of the whole system, and they are also the stop signal:
 * a follow-up that lands after someone has already answered is worse than no
 * follow-up at all. So one handler does three things, in the order that matters
 * if a later step fails:
 *   1. record the reply as an outreach_event
 *   2. cancel that contact's queued follow-ups
 *   3. forward the mail on, so a human actually sees it
 *
 * Recording a reply is deliberately safe: handle_optout only suppresses on
 * 'unsubscribed' / 'bounced', so answering never removes a lead from
 * outreach_ready.
 *
 * Auth mirrors webhook.js — a shared secret in a header or query param.
 */

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

/** "Jan Jansen <jan@x.nl>" → "jan@x.nl" */
function addressOf(from) {
  if (!from) return '';
  const angled = /<([^>]+)>/.exec(from);
  return (angled ? angled[1] : from).trim().toLowerCase();
}

/**
 * Resend gives `in_reply_to` (the Message-ID we sent) plus `references` for
 * deeper threads. We stored Resend's own id as provider_message_id, so try the
 * thread headers first and fall back to matching the sender's address.
 */
async function findMessage(env, payload) {
  const candidates = [
    payload?.in_reply_to ?? payload?.inReplyTo,
    ...(Array.isArray(payload?.references) ? payload.references : []),
  ].filter(Boolean);

  for (const raw of candidates) {
    // Message-IDs arrive wrapped in angle brackets; ours are bare uuids.
    const id = String(raw).replace(/^<|>$/g, '').trim();
    const rows = await sbJson(
      env,
      `outreach_messages?provider_message_id=eq.${encodeURIComponent(id)}` +
        `&select=id,contact_id,campaign_id,step_number&limit=1`,
    );
    if (rows?.length) return { message: rows[0], matchedBy: 'thread' };
  }

  // Fallback: the reply came from an address we mailed. Newest first, because a
  // contact may appear in more than one campaign over time.
  const email = addressOf(payload?.from);
  if (email) {
    const rows = await sbJson(
      env,
      `outreach_messages?to_email=ilike.${encodeURIComponent(email)}&status=eq.sent` +
        `&select=id,contact_id,campaign_id,step_number&order=sent_at.desc&limit=1`,
    );
    if (rows?.length) return { message: rows[0], matchedBy: 'address' };
  }

  return { message: null, matchedBy: null };
}

/** Forward to a human. Best-effort: a failure here must not lose the reply. */
async function forward(env, payload, message, matchedBy) {
  if (!env.OUTREACH_REPLY_FORWARD_TO || !env.RESEND_API_KEY || !env.OUTREACH_FROM) return false;

  const replyTo = addressOf(payload?.from);
  const subject = payload?.subject ?? '(no subject)';
  const text = payload?.text ?? payload?.html ?? '(no body)';

  const context = message
    ? `Reply from ${replyTo} — campaign ${message.campaign_id}, step ${message.step_number ?? 1}. ` +
      `Remaining follow-ups for this contact have been cancelled.`
    : `Reply from ${replyTo} — could not be matched to a sent message (${matchedBy ?? 'no match'}), ` +
      `so no follow-ups were cancelled. Check before this contact is mailed again.`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.OUTREACH_FROM,
      to: [env.OUTREACH_REPLY_FORWARD_TO],
      // So hitting reply in the normal inbox answers the prospect, not us.
      reply_to: replyTo || undefined,
      subject: `[Outreach reply] ${subject}`,
      text: `${context}\n\n---\n\n${text}`,
    }),
  });
  return res.ok;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  if (env.RESEND_INBOUND_SECRET) {
    const url = new URL(request.url);
    const provided = request.headers.get('x-webhook-secret') ?? url.searchParams.get('secret');
    if (provided !== env.RESEND_INBOUND_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let payload;
  try { payload = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Resend nests the mail under `data` for webhook-style deliveries.
  const mail = payload?.data ?? payload;

  try {
    const { message, matchedBy } = await findMessage(env, mail);

    if (message) {
      await sb(env, 'outreach_events', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          contact_id: message.contact_id,
          campaign: message.campaign_id,
          event_type: 'replied',
          meta: { provider: 'resend', matched_by: matchedBy, from: addressOf(mail?.from) },
        }),
      });

      // Stop the sequence for this contact everywhere, not just this campaign —
      // someone who answered should not keep hearing from us on another thread.
      await sb(env, `outreach_messages?contact_id=eq.${message.contact_id}&status=eq.queued`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'canceled', skip_reason: 'replied' }),
      });
    }

    // Always forward, matched or not — an unmatched reply is still a human
    // waiting on an answer, and dropping it is the one unrecoverable outcome.
    const forwarded = await forward(env, mail, message, matchedBy);

    return Response.json({
      ok: true,
      matched: Boolean(message),
      matched_by: matchedBy,
      forwarded,
    });
  } catch (e) {
    return Response.json({ error: e?.message ?? 'Inbound failed' }, { status: 500 });
  }
}
