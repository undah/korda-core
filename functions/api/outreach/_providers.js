/**
 * Sending adapters.
 *
 * One shape, several vendors, because the vendor is not a permanent decision.
 * Cold outreach is prohibited outright by some transactional providers —
 * Resend's Acceptable Use Policy bans "cold outreach, purchased lists, or
 * scraped contact data" and requires that every recipient "explicitly opted
 * in" — so a system built on scraped leads has to be able to move providers
 * without the send path being rewritten around it.
 *
 * A NOTE ON SMTP: most cold-email infrastructure is plain SMTP, and Cloudflare
 * Workers cannot open raw TCP sockets, so an SMTP adapter cannot live here. If
 * you move to SMTP mailboxes, the send loop itself has to move to the pipeline
 * host (which already runs the scheduler and can open sockets). The interface
 * below is deliberately transport-agnostic so that move is a relocation rather
 * than a rewrite.
 *
 * Each adapter takes a normalised message plus the resolved credential and
 * returns { id } on success, or throws with a useful message.
 */

/** @typedef {{ from: string, fromName?: string|null, to: string, replyTo?: string|null,
 *              subject: string, text: string, html: string, headers?: Record<string,string> }} OutgoingMail */

function formatFrom(mail) {
  return mail.fromName ? `${mail.fromName} <${mail.from}>` : mail.from;
}

/** Resend — transactional. Permitted for opted-in mail only; see the note above. */
async function sendViaResend(mail, credential) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credential}`,
      'Content-Type': 'application/json',
    },
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
 * Generic JSON-over-HTTP adapter, for vendors that accept cold outreach and
 * expose a simple send endpoint. Configured by env rather than code so a new
 * vendor does not need a deploy:
 *
 *   OUTREACH_HTTP_ENDPOINT   full URL to POST to
 *   OUTREACH_HTTP_AUTH_STYLE 'bearer' (default) | 'header' | 'query'
 *   OUTREACH_HTTP_AUTH_NAME  header or query param name when not bearer
 *
 * The body uses the common from/to/subject/text/html shape. Anything more
 * exotic deserves its own named adapter.
 */
async function sendViaHttp(mail, credential, env) {
  const endpoint = env.OUTREACH_HTTP_ENDPOINT;
  if (!endpoint) throw new Error('OUTREACH_HTTP_ENDPOINT is not configured');

  const style = env.OUTREACH_HTTP_AUTH_STYLE ?? 'bearer';
  const name = env.OUTREACH_HTTP_AUTH_NAME ?? 'Authorization';

  const url = new URL(endpoint);
  const headers = { 'Content-Type': 'application/json' };

  if (style === 'query') url.searchParams.set(name, credential);
  else if (style === 'header') headers[name] = credential;
  else headers.Authorization = `Bearer ${credential}`;

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: mail.from,
      from_name: mail.fromName ?? undefined,
      to: mail.to,
      reply_to: mail.replyTo || undefined,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Provider ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  }
  const data = await res.json().catch(() => ({}));
  return { id: data.id ?? data.message_id ?? data.messageId ?? null };
}

const ADAPTERS = {
  resend: sendViaResend,
  http: sendViaHttp,
};

export function providerNames() {
  return Object.keys(ADAPTERS);
}

/**
 * Send one message through the named provider.
 * `credential` is resolved by the caller from env — never read from the
 * database, so a key cannot leak through the console's anon client.
 */
export async function sendMail(provider, mail, credential, env) {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`Unknown sending provider "${provider}"`);
  if (!credential) throw new Error(`No credential configured for provider "${provider}"`);
  return adapter(mail, credential, env);
}
