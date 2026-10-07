/**
 * budget-cron — the clock for KordaBudget's background job.
 *
 * Cloudflare Pages Functions can't run on a schedule, a Worker can. This one
 * only knocks on /api/budget/cron with a shared secret; the work itself lives
 * in the Pages app, next to the rest of the code:
 *   1. stap=sync, repeated while it says there's more (a few accounts per call,
 *      because one call may only make so many outgoing requests);
 *   2. stap=meldingen, the push notifications.
 *
 * Variables (Worker → Settings → Variables and Secrets):
 *   SITE_URL            https://kordacore.com
 *   BUDGET_CRON_SECRET  secret, the same value as in the Pages project
 */
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(draai(env));
  },
  // Opening the Worker's URL shows it's alive, without running the job.
  async fetch() {
    return new Response('KordaBudget cron: draait 4× per dag.\n', { headers: { 'content-type': 'text/plain' } });
  },
};

async function stap(env, naam) {
  const res = await fetch(`${(env.SITE_URL ?? 'https://kordacore.com').replace(/\/$/, '')}/api/budget/cron?stap=${naam}`, {
    method: 'POST',
    headers: { 'x-cron-secret': env.BUDGET_CRON_SECRET ?? '' },
  });
  const tekst = await res.text();
  console.log(naam, res.status, tekst); // shows in the Worker's logs
  try {
    return { ok: res.ok, ...JSON.parse(tekst) };
  } catch {
    return { ok: false };
  }
}

async function draai(env) {
  for (let i = 0; i < 8; i++) {
    const r = await stap(env, 'sync');
    if (!r.ok || !r.meer) break;
  }
  await stap(env, 'meldingen');
}
