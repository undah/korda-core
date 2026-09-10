/**
 * /api/outreach/unsubscribe?t=<unsubscribe_token>
 *
 * Public on purpose — this is the link inside every email, so it must work for
 * someone who has never signed in and never will.
 *
 * GET only asks. POST is what suppresses.
 *
 * It used to suppress on GET, which quietly destroyed leads: corporate mail
 * security — Outlook Safe Links, Proofpoint, Mimecast — fetches every URL in an
 * inbound message to check it. That fetch is a GET, so a prospect who never
 * touched the link was unsubscribed by their own employer's scanner, and the
 * record looked identical to a real opt-out. RFC 8058 requires POST for
 * one-click unsubscribe for exactly this reason.
 *
 * Nothing is lost for the recipient: Gmail's own Unsubscribe button POSTs here
 * because the mail carries List-Unsubscribe-Post, and a human clicking the link
 * in the body gets a page with one button.
 *
 * Writing the `unsubscribed` event fires the existing handle_optout trigger,
 * which writes the address into suppression_list; outreach_ready then stops
 * returning them permanently.
 */

const SHELL = (body) =>
  `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribe</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#faf9f7;font-family:-apple-system,Segoe UI,sans-serif;color:#222">
  <div style="max-width:420px;padding:2.5rem;text-align:center">${body}</div>
</body></html>`;

function page(title, message, tone = '#16a34a') {
  return new Response(
    SHELL(`
    <div style="width:44px;height:44px;border-radius:50%;background:${tone}1a;color:${tone};display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:22px">✓</div>
    <h1 style="font-size:1.15rem;margin:0 0 .5rem">${title}</h1>
    <p style="font-size:.9rem;line-height:1.6;color:#666;margin:0">${message}</p>`),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/** The confirm step. A scanner will fetch this and stop; a person clicks. */
function confirmPage(token) {
  return new Response(
    SHELL(`
    <h1 style="font-size:1.15rem;margin:0 0 .5rem">Unsubscribe?</h1>
    <p style="font-size:.9rem;line-height:1.6;color:#666;margin:0 0 1.5rem">
      Confirm and you will not receive any further emails from us.
    </p>
    <form method="POST">
      <input type="hidden" name="t" value="${escapeAttr(token)}">
      <button type="submit" style="border:0;border-radius:8px;background:#16a34a;color:#fff;font-size:.9rem;padding:.7rem 1.6rem;cursor:pointer">
        Yes, unsubscribe me
      </button>
    </form>
    <p style="font-size:.75rem;color:#999;margin:1.25rem 0 0">
      Nothing happens until you press the button.
    </p>`),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

const escapeAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function onRequestGet(context) {
  const token = new URL(context.request.url).searchParams.get('t');
  if (!token) return page('Invalid link', 'This unsubscribe link is missing its token.', '#dc2626');
  return confirmPage(token);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // The token arrives in the form body from our own page, or in the query
  // string from a one-click client, which POSTs to the List-Unsubscribe URL
  // as-is without inventing a body.
  let token = new URL(request.url).searchParams.get('t');
  if (!token) {
    try {
      const form = await request.formData();
      token = form.get('t');
    } catch {
      /* one-click senders may post an empty or non-form body */
    }
  }

  if (!token) return page('Invalid link', 'This unsubscribe link is missing its token.', '#dc2626');
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return page('Something went wrong', 'Please reply to the email and we will remove you by hand.', '#dc2626');
  }

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/outreach_messages?unsubscribe_token=eq.${encodeURIComponent(token)}` +
        `&select=contact_id,to_email,campaign_id`,
      { headers },
    );
    const rows = await res.json();
    const msg = rows?.[0];

    // Don't reveal whether a token is real — just confirm either way.
    if (!msg) return page("You're unsubscribed", 'You will not receive any further emails from us.');

    await fetch(`${env.SUPABASE_URL}/rest/v1/outreach_events`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        contact_id: msg.contact_id,
        campaign: msg.campaign_id,
        event_type: 'unsubscribed',
        meta: { via: 'link' },
      }),
    });

    return page("You're unsubscribed", `${msg.to_email} has been removed. You will not receive any further emails from us.`);
  } catch {
    return page('Something went wrong', 'Please reply to the email and we will remove you by hand.', '#dc2626');
  }
}
