/**
 * Auth gate for /api/tracker/*.
 *
 * These routes spend the suite's Anthropic key. They used to answer anyone who
 * found them; now that anyone can make an account the door at least needs a
 * live Supabase session. Same check as functions/api/budget/_middleware.js.
 */
const weg = (reden, status = 401) => Response.json({ error: reden }, { status });

export async function onRequest(context) {
  const { request, env, next } = context;
  if (request.method === 'OPTIONS') return next();

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return weg('Auth is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).', 500);
  }

  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return weg('Sign in again');

  let res;
  try {
    res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
    });
  } catch {
    return weg('Could not verify the session', 503);
  }
  const user = res.ok ? await res.json().catch(() => null) : null;
  if (!user?.id) return weg('Session expired, sign in again');

  context.data = { ...(context.data ?? {}), userId: user.id };
  return next();
}
