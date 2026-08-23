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

/*
 * ── bounce detection ────────────────────────────────────────────────────────
 *
 * A bounce arrives as an ordinary inbound mail, from the receiving side's
 * mailer rather than from a person. Left undetected it looks like a reply:
 * it would cancel the contact's follow-ups, count as engagement, and quietly
 * inflate the one metric the whole system is judged on.
 *
 * The distinction that matters is permanent vs temporary. A 5.x.x status means
 * the address does not exist and must never be mailed again; a 4.x.x is a full
 * mailbox or a server having a bad afternoon, and suppressing on it would throw
 * away a good lead for a problem that fixes itself. Only permanent failures
 * write a `bounced` event — which is what the handle_optout trigger watches, so
 * that single write is also what suppresses the address.
 *
 * Bounce rate above ~3% is what gets a sending domain flagged, so this is also
 * the number the analytics page leads with. It cannot report what it never
 * recorded.
 */

const BOUNCE_SUBJECT =
  /undeliver|delivery (status notification|failure|has failed)|failure notice|returned mail|mail delivery (failed|subsystem)|delivery incomplete/i;

/** Mailers announce themselves in the local part, whatever the domain. */
function isBounceSender(address) {
  return /^(mailer-daemon|postmaster|no-?reply-daemon)@/.test(address);
}

/**
 * Pulled out and exported so the classification is testable on real NDR text
 * without standing up a mail server.
 *
 * Returns `permanent: null` when something is clearly a bounce but carries no
 * readable status code — treated as temporary, because the cost of wrongly
 * suppressing a real lead is higher than the cost of one wasted retry.
 */
export function parseBounce(mail) {
  const from = addressOf(mail?.from);
  const subject = String(mail?.subject ?? '');
  const body = String(mail?.text ?? mail?.html ?? '');
  const contentType = String(mail?.headers?.['content-type'] ?? mail?.content_type ?? '');

  const isBounce =
    isBounceSender(from) ||
    BOUNCE_SUBJECT.test(subject) ||
    /report-type=delivery-status/i.test(contentType);

  if (!isBounce) return { isBounce: false, permanent: false, failedRecipient: null, statusCode: null };

  // RFC 3463 status, e.g. "5.1.1" — the digit before the first dot is the class.
  const status = /\b([45])\.\d{1,3}\.\d{1,3}\b/.exec(body);
  // Fall back to the bare SMTP reply code ("550", "452") when no DSN is present.
  const smtp = status ? null : /\b(5\d{2}|4\d{2})\b(?=[\s:-])/.exec(body);

  const permanent = status ? status[1] === '5' : smtp ? smtp[1].startsWith('5') : null;

  // The address that failed is not the sender — the sender is the mailer. Prefer
  // an explicit DSN field, then the first address that isn't our own mailer.
  const explicit = /(?:Final-Recipient|Original-Recipient):\s*rfc822;\s*([^\s<>]+@[^\s<>]+)/i.exec(body);
  let failedRecipient = explicit ? explicit[1].toLowerCase() : null;
  if (!failedRecipient) {
    const found = body.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
    failedRecipient = found.map(a => a.toLowerCase()).find(a => !isBounceSender(a)) ?? null;
  }

  return {
    isBounce: true,
    permanent,
    failedRecipient,
    statusCode: status ? status[0] : smtp ? smtp[1] : null,
  };
}

/**
 * Resend gives `in_reply_to` (the Message-ID we sent) plus `references` for
 * deeper threads. We stored Resend's own id as provider_message_id, so try the
 * thread headers first and fall back to matching the sender's address.
 */
async function findMessage(env, payload, addressOverride = null) {
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
  // contact may appear in more than one campaign over time. For a bounce the
  // override carries the failed recipient — `from` there is the remote mailer,
  // which we never sent anything to and would never match.
  const email = addressOverride ?? addressOf(payload?.from);
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
    // ── bounce, not a reply ──
    // Checked first: a bounce that fell through to the reply path would cancel
    // the contact's follow-ups and be counted as engagement, which is the one
    // way this system could look like it is working while it is not.
    const bounce = parseBounce(mail);
    if (bounce.isBounce) {
      const { message } = await findMessage(env, mail, bounce.failedRecipient);
      const address = bounce.failedRecipient ?? null;

      if (bounce.permanent === true) {
        if (message) {
          // handle_optout watches for exactly this event and suppresses the
          // address, so this single write is the whole suppression path.
          await sb(env, 'outreach_events', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              contact_id: message.contact_id,
              campaign: message.campaign_id,
              event_type: 'bounced',
              meta: { status_code: bounce.statusCode, address, provider: 'gmail' },
            }),
          });

          await sb(env, `contacts?id=eq.${message.contact_id}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ email_status: 'bounced' }),
          });

          // Nothing queued should go to a dead address, in this campaign or any
          // other — the mailbox will not start existing again.
          await sb(env, `outreach_messages?contact_id=eq.${message.contact_id}&status=eq.queued`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ status: 'canceled', skip_reason: 'bounced' }),
          });
        } else if (address) {
          // Unmatched but clearly dead: suppress the address itself so it can
          // never be picked up by a future crawl of the same business.
          await sb(env, 'suppression_list', {
            method: 'POST',
            headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
            body: JSON.stringify({ email: address, reason: `hard bounce ${bounce.statusCode ?? ''}`.trim() }),
          });
        }
      }

      return Response.json({
        ok: true,
        kind: 'bounce',
        permanent: bounce.permanent,
        status_code: bounce.statusCode,
        address,
        matched: Boolean(message),
        // A temporary failure is deliberately left alone — a full mailbox is not
        // a reason to burn a lead. It is not forwarded either; it is noise.
        suppressed: bounce.permanent === true,
      });
    }

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
