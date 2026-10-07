/**
 * Auth gate for /api/budget/*.
 *
 * These routes act with the service role and the Enable Banking key, so every
 * one of them needs a live Supabase session; the route then checks the user
 * belongs to the household or owns the account. Same check as
 * functions/api/outreach/_middleware.js, so a new route is protected by default.
 *
 * One exception: /api/budget/cron, called by the scheduled Worker, which has no
 * user. It must carry BUDGET_CRON_SECRET instead, and is refused outright when
 * that secret isn't configured.
 */

const CRON = '/api/budget/cron';

/** Compare without leaking how many leading characters matched. */
function gelijk(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let verschil = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) verschil |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return verschil === 0;
}

const weg = (reden, status = 401) => Response.json({ error: reden }, { status });

export async function onRequest(context) {
  const { request, env, next } = context;
  if (request.method === 'OPTIONS') return next();

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    // Fail closed: a missing variable must not open the door.
    return weg('De server is niet ingesteld (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).', 500);
  }

  if (new URL(request.url).pathname.replace(/\/+$/, '') === CRON) {
    const geheim = env.BUDGET_CRON_SECRET ?? '';
    const gegeven = request.headers.get('x-cron-secret') ?? '';
    if (geheim.length < 24 || !gelijk(gegeven, geheim)) return weg('Niet toegestaan', 403);
    return next();
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
