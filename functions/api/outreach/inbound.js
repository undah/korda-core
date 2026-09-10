/**
 * POST /api/outreach/inbound — inbound (reply) receiver.
 *
 * Sending is Google Workspace over the Gmail API, and Gmail does not push mail
 * to an endpoint on its own. So something has to poll the mailbox and post what
 * it finds here — the pipeline host, which already holds the Gmail credentials.
 * Classification and recording stay here because that is where the code and its
 * tests live; the poller only needs to move bytes.
 *
 * Contract — POST with `x-webhook-secret: <OUTREACH_INBOUND_SECRET>` and a JSON
 * body per new message:
 *
 *   {
 *     "from":         "Jan Jansen <jan@klant.nl>",   // required
 *     "subject":      "Re: samenwerking",
 *     "text":         "...plain body...",            // or "html"
 *     "in_reply_to":  "<message-id we sent>",        // Gmail: In-Reply-To header
 *     "references":   ["<...>", "<...>"],            // Gmail: References header
 *     "headers":      { "content-type": "..." }      // helps bounce detection
 *   }
 *
 * in_reply_to should carry the same id stored on the message as
 * provider_message_id, which is what lets a reply match its thread. Without it
 * the sender's address is used instead, which is correct but weaker: it matches
 * the most recent sent message to that address.
 *
 * Post each message once — a repeat writes a second event. Replies are
 * de-duplicated per contact when rates are computed, so a duplicate will not
 * skew a percentage, but it will show twice on the Messages page.
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
 * Auth: a shared secret in a header (x-webhook-secret) or query param.
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

/**
 * Where the bounce report stops and the returned message begins. Everything
 * below this is our own text coming back to us, not the server's verdict.
 */
const ORIGINAL_MESSAGE =
  /(?:^|\n)\s*(?:-{2,}\s*(?:original|forwarded|returned)\s+message|content-type:\s*message\/rfc822|below this line is a copy|begin message headers)/i;

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

  // An NDR normally attaches the message that failed, and our own copy can
  // easily hold a bare number in the 4xx/5xx range ('500 euro', '450 leads')
  // which would then read as a permanent failure and suppress a live contact
  // forever. Both searches are limited to the report, above the quoted copy.
  const cut = body.search(ORIGINAL_MESSAGE);
  const report = cut > 0 ? body.slice(0, cut) : body;

  // RFC 3463 status, e.g. "5.1.1" — the digit before the first dot is the class.
  const status = /\b([45])\.\d{1,3}\.\d{1,3}\b/.exec(report);
  // Fall back to a bare SMTP reply code, but only where a server states one:
  // at the start of a line, or introduced by the mailer.
  const smtp = status
    ? null
    : /(?:^\s*|said:\s*|responded(?:\s+with)?:\s*|response(?:\s+was)?:\s*)([45]\d{2})\b/im.exec(report);

  const permanent = status ? status[1] === '5' : smtp ? smtp[1].startsWith('5') : null;

  // The address that failed is not the sender — the sender is the mailer. Prefer
  // an explicit DSN field, then the first address that isn't our own mailer.
  const explicit = /(?:Final-Recipient|Original-Recipient):\s*rfc822;\s*([^\s<>]+@[^\s<>]+)/i.exec(report);
  let failedRecipient = explicit ? explicit[1].toLowerCase() : null;
  if (!failedRecipient) {
    const found = report.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
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
 * Match on the thread first: `in_reply_to` is the Message-ID we sent, and
 * `references` carries deeper threads. We store the provider's own id as
 * provider_message_id. Falls back to the sender's address when the poster
 * cannot supply thread headers.
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
    // ILIKE treats _ and % as wildcards, and underscores are ordinary in email
    // addresses: unescaped, jan_jansen@x.nl also matches janXjansen@x.nl and would
    // cancel the wrong contact's follow-ups. Postgres escapes with a backslash.
    const pattern = email.replace(/[\\%_]/g, m => `\\${m}`);
    const rows = await sbJson(
      env,
      `outreach_messages?to_email=ilike.${encodeURIComponent(pattern)}&status=eq.sent` +
        `&select=id,contact_id,campaign_id,step_number&order=sent_at.desc&limit=1`,
    );
    if (rows?.length) return { message: rows[0], matchedBy: 'address' };
  }

  return { message: null, matchedBy: null };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  // Fail closed. This was `if (env.<SECRET>)`, so an unset variable — a typo, a
  // forgotten setting on a new environment — left the endpoint open to anyone,
  // and a forged payload here writes bounce and reply events that suppress real
  // leads. The old name is still read so a deployment that already sets it keeps
  // working; set OUTREACH_INBOUND_SECRET and the legacy one can be deleted.
  const inboundSecret = env.OUTREACH_INBOUND_SECRET ?? env.RESEND_INBOUND_SECRET;
  if (!inboundSecret) {
    return Response.json(
      { error: 'Inbound is not configured: set OUTREACH_INBOUND_SECRET.' },
      { status: 500 },
    );
  }
  {
    const url = new URL(request.url);
    const provided = request.headers.get('x-webhook-secret') ?? url.searchParams.get('secret');
    if (provided !== inboundSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let payload;
  try { payload = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Accept either a bare mail object or one nested under `data`.
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
          meta: { provider: 'gmail', matched_by: matchedBy, from: addressOf(mail?.from) },
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

    // The reply is recorded and the follow-ups are cancelled; the Messages page
    // is where a human reads it. There used to be an email relay here, but it
    // went out through a provider this project does not use, so it returned
    // false on every reply and told nobody. A relay that silently does nothing
    // is worse than no relay, because it looks like one.
    return Response.json({
      ok: true,
      matched: Boolean(message),
      matched_by: matchedBy,
    });
  } catch (e) {
    return Response.json({ error: e?.message ?? 'Inbound failed' }, { status: 500 });
  }
}
