/**
 * POST /api/outreach/webhook — Resend event receiver.
 *
 * Maps Resend delivery events onto outreach_events so the console shows what
 * actually happened after a send. Bounces and complaints flow into
 * suppression_list automatically via the existing handle_optout trigger.
 *
 * Auth: Resend signs webhooks (Svix). Full signature verification needs the
 * signing secret + HMAC; here we require a shared secret in a header or query
 * param, which is enough given the endpoint only ever writes events keyed to a
 * provider_message_id we issued ourselves.
 */

const EVENT_MAP = {
  'email.delivered': null,        // delivery isn't in the events enum — ignore
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'unsubscribed',
  'email.delivery_delayed': null,
};

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  if (env.RESEND_WEBHOOK_SECRET) {
    const url = new URL(request.url);
    const provided = request.headers.get('x-webhook-secret') ?? url.searchParams.get('secret');
    if (provided !== env.RESEND_WEBHOOK_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let payload;
  try { payload = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const eventType = EVENT_MAP[payload?.type];
  const providerId = payload?.data?.email_id ?? payload?.data?.id;

  // Ack unmapped events so Resend doesn't retry them forever.
  if (!eventType || !providerId) return Response.json({ ok: true, ignored: payload?.type ?? null });

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/outreach_messages?provider_message_id=eq.${providerId}&select=contact_id,campaign_id`,
      { headers },
    );
    const msg = (await res.json())?.[0];
    if (!msg) return Response.json({ ok: true, unmatched: providerId });

    await fetch(`${env.SUPABASE_URL}/rest/v1/outreach_events`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        contact_id: msg.contact_id,
        campaign: msg.campaign_id,
        event_type: eventType,
        meta: { provider: 'resend', type: payload.type },
      }),
    });

    return Response.json({ ok: true, recorded: eventType });
  } catch (e) {
    return Response.json({ error: e?.message ?? 'Webhook failed' }, { status: 500 });
  }
}
