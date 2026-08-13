/**
 * GET /api/outreach/unsubscribe?t=<unsubscribe_token>
 *
 * Public on purpose — this is the link inside every email, so it must work for
 * someone who has never signed in. Logging the `unsubscribed` event fires the
 * existing handle_optout trigger, which writes the address into
 * suppression_list; outreach_ready then stops returning them permanently.
 */

function page(title, message, tone = '#16a34a') {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#faf9f7;font-family:-apple-system,Segoe UI,sans-serif;color:#222">
  <div style="max-width:420px;padding:2.5rem;text-align:center">
    <div style="width:44px;height:44px;border-radius:50%;background:${tone}1a;color:${tone};display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:22px">✓</div>
    <h1 style="font-size:1.15rem;margin:0 0 .5rem">${title}</h1>
    <p style="font-size:.9rem;line-height:1.6;color:#666;margin:0">${message}</p>
  </div>
</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get('t');

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
      `${env.SUPABASE_URL}/rest/v1/outreach_messages?unsubscribe_token=eq.${token}&select=contact_id,to_email,campaign_id`,
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
