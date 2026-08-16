/**
 * POST /api/outreach/send-now  { messageIds: [...] }
 *
 * Browser-facing trigger for an individual send. `/api/outreach/send` itself
 * is guarded by SEND_TRIGGER_SECRET, which only the scheduler (Railway) knows
 * — the browser was never meant to hold it, the same reasoning as `run.js`
 * proxying to the pipeline's own secret. This function holds the secret
 * instead and makes the internal call on the browser's behalf, so an
 * individual send goes out immediately rather than waiting for the scheduler
 * to notice a due message on its next tick.
 *
 * Every guard in send.js — suppression, do-not-contact, replies, duplicate
 * address, daily caps — still runs. This is a different door into the same
 * room, not a bypass.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SEND_TRIGGER_SECRET) {
    return Response.json({ error: 'SEND_TRIGGER_SECRET not configured' }, { status: 500 });
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { messageIds } = body;
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return Response.json({ error: 'messageIds must be a non-empty array' }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  try {
    const res = await fetch(`${origin}/api/outreach/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-send-secret': env.SEND_TRIGGER_SECRET,
      },
      body: JSON.stringify({ messageIds }),
    });
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  } catch (e) {
    return Response.json(
      { error: `Could not reach the send endpoint: ${e?.message ?? 'unknown error'}` },
      { status: 502 },
    );
  }
}
