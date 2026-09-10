/**
 * Auth gate for /api/outreach/*
 *
 * These endpoints hold server-side secrets — SEND_TRIGGER_SECRET,
 * RUN_TRIGGER_SECRET — and forward to the pipeline on the browser's behalf.
 * That is the whole point of them: the browser must never learn those secrets.
 * But it also means an unauthenticated caller reaching one of these functions
 * gets to act with those secrets, which is exactly the failure send.js warned
 * about: "an endpoint anyone could POST to would let a caller bypass it, the
 * one mistake that burns a sending domain."
 *
 * Supabase RLS guards the tables. It does not guard these routes, because they
 * never touch a table — they call the pipeline. So the check lives here, once,
 * in front of everything, rather than in each function where a new endpoint
 * would silently be born without it.
 *
 * A leading underscore keeps this file out of the route table; Pages runs it as
 * middleware for every request under this directory.
 */

/**
 * Routes that must NOT require a user session. Matched on the exact pathname,
 * not the last segment — a suffix match would exempt anything ending in
 * "/unsubscribe".
 *
 *  unsubscribe  public by design: the link is in every email we send, and has
 *               to work for someone who has never signed in and never will.
 *  inbound      a machine caller: whatever polls the sending mailbox and posts
 *               new mail here. It authenticates with its own shared secret,
 *               which the function verifies itself; a user JWT is meaningless
 *               for it.
 *  send         already gated by SEND_TRIGGER_SECRET, and its callers are
 *               machines that hold it: the Railway scheduler, and send-now.js
 *               as a same-origin subrequest. A subrequest carries no user
 *               session, so requiring one here would break sending outright.
 *               send-now.js is the browser's door to it, and that one does
 *               need a session.
 *
 * Anything not listed needs a session. A new endpoint is therefore protected
 * by default rather than by remembering to protect it.
 */
const NO_SESSION = new Set([
  '/api/outreach/unsubscribe',
  '/api/outreach/inbound',
  '/api/outreach/send',
]);

const unauthorized = (reason) =>
  Response.json({ error: `Unauthorized: ${reason}` }, { status: 401 });

export async function onRequest(context) {
  const { request, env, next } = context;

  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  if (NO_SESSION.has(path)) return next();

  // CORS preflight carries no credentials by definition.
  if (request.method === 'OPTIONS') return next();

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    // Fail closed. A missing env var must not open the door.
    return Response.json(
      { error: 'Auth is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 500 },
    );
  }

  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return unauthorized('missing bearer token');

  // Ask Supabase whether this access token is a live session. Cheaper to reason
  // about than verifying the signature here, and it honours revocation.
  let res;
  try {
    res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (e) {
    return Response.json(
      { error: `Could not verify the session: ${e?.message ?? 'unknown error'}` },
      { status: 503 },
    );
  }

  if (!res.ok) return unauthorized('invalid or expired session');

  const user = await res.json().catch(() => null);
  if (!user?.id) return unauthorized('invalid or expired session');

  // Downstream functions can read who is acting without re-verifying.
  context.data = { ...(context.data ?? {}), userId: user.id, userEmail: user.email ?? null };
  return next();
}
