/**
 * Auth gate for /api/budget/*.
 *
 * These routes act with the service role and the Enable Banking key, so every
 * one of them needs a live Supabase session; the route then checks the user
 * belongs to the household or owns the account. Same check as
 * functions/api/outreach/_middleware.js, without exceptions: nothing here is
 * public, so a new route is protected by default.
 */

const weg = (reden, status = 401) => Response.json({ error: reden }, { status });

export async function onRequest(context) {
  const { request, env, next } = context;
  if (request.method === 'OPTIONS') return next();

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    // Fail closed: a missing variable must not open the door.
    return weg('De server is niet ingesteld (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).', 500);
  }

  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return weg('Log opnieuw in');

  let res;
  try {
    res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
    });
  } catch {
    return weg('Kon je sessie niet controleren', 503);
  }
  const user = res.ok ? await res.json().catch(() => null) : null;
  if (!user?.id) return weg('Je sessie is verlopen, log opnieuw in');

  context.data = { ...(context.data ?? {}), userId: user.id };
  return next();
}
