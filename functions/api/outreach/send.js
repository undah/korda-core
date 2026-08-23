/**
 * POST /api/outreach/send  { campaignId, limit? } | { messageIds: [...] }
 *
 * Proxies a send request to the hosted pipeline. The actual send — the guard
 * loop (suppression, do-not-contact, replies, duplicate address, daily caps)
 * and every sending adapter, including SMTP — now lives on the Railway
 * pipeline host (see korda-outreach/src/send.ts), not here. It moved because
 * a real mailbox sends over SMTP, and Cloudflare Workers cannot open the raw
 * TCP sockets that requires; the pipeline already runs Node and already hosts
 * the scheduler that drains campaigns.
 *
 * SEND_TRIGGER_SECRET is the browser-facing gate: only send-now.js (an
 * individual send from a lead's page) and the pipeline's own scheduler-tick
 * path are meant to reach this endpoint, and pacing is deliberate — an
 * endpoint anyone could POST to would let a caller bypass it, the one mistake
 * that burns a sending domain. RUN_TRIGGER_SECRET is the separate secret that
 * authenticates this function to the pipeline itself, the same one run.js and
 * personalize.js already use.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SEND_TRIGGER_SECRET) {
    return Response.json({ error: 'SEND_TRIGGER_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('x-send-secret') !== env.SEND_TRIGGER_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!env.PIPELINE_URL || !env.RUN_TRIGGER_SECRET) {
    return Response.json(
      { error: 'Sending is not configured (PIPELINE_URL / RUN_TRIGGER_SECRET).' },
      { status: 500 },
    );
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { campaignId, limit, messageIds } = body;
  if (!campaignId && !(Array.isArray(messageIds) && messageIds.length > 0)) {
    return Response.json({ error: 'campaignId or messageIds is required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${env.PIPELINE_URL.replace(/\/$/, '')}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-run-secret': env.RUN_TRIGGER_SECRET,
      },
      body: JSON.stringify({ campaignId, limit, messageIds }),
    });

    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  } catch (e) {
    return Response.json(
      { error: `Could not reach the pipeline service: ${e?.message ?? 'unknown error'}` },
      { status: 502 },
    );
  }
}
