/**
 * Auth gate for /api/admin/*: a live Supabase session that belongs to an admin
 * (korda_admins, supabase/suite_toegang.sql).
 *
 * These routes use the service role on auth.users: they can change anyone's
 * password or delete anyone. So both checks run on every request, and a
 * missing table or variable shuts the door rather than opening it.
 */
const weg = (reden, status = 401) => Response.json({ error: reden }, { status });

export async function onRequest(context) {
  const { request, env, next } = context;
  if (request.method === 'OPTIONS') return next();

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return weg('Auth is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).', 500);
  }
  const basis = env.SUPABASE_URL.replace(/\/$/, '');
  const sleutel = env.SUPABASE_SERVICE_ROLE_KEY;

  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return weg('Sign in again');

  let user = null;
  try {
    const res = await fetch(`${basis}/auth/v1/user`, { headers: { apikey: sleutel, Authorization: `Bearer ${token}` } });
    user = res.ok ? await res.json().catch(() => null) : null;
  } catch {
    return weg('Could not verify the session', 503);
  }
  if (!user?.id) return weg('Session expired, sign in again');

  let admin = false;
  try {
    const r = await fetch(`${basis}/rest/v1/korda_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`, {
      headers: { apikey: sleutel, Authorization: `Bearer ${sleutel}` },
    });
    admin = r.ok && ((await r.json().catch(() => [])) ?? []).length > 0;
  } catch {
    admin = false;
  }
  if (!admin) return weg('Admins only', 403);

  context.data = { ...(context.data ?? {}), userId: user.id, userEmail: user.email ?? null };
  return next();
}
