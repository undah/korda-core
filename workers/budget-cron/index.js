/**
 * budget-cron — the clock for KordaBudget's background job.
 *
 * Cloudflare Pages Functions can't run on a schedule, a Worker can. This one
 * only knocks on /api/budget/cron with a shared secret; the work itself (bank
 * sync, and later notifications and insights) lives in the Pages app, next to
 * the rest of the code.
 *
 * Variables (Worker → Settings → Variables and Secrets):
 *   SITE_URL            https://kordacore.com
 *   BUDGET_CRON_SECRET  secret, the same value as in the Pages project
 */
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(roep(env));
  },
  // Opening the Worker's URL shows its state, without running the job.
  async fetch() {
    return new Response('KordaBudget cron: draait 4× per dag.\n', { headers: { 'content-type': 'text/plain' } });
  },
};

async function roep(env) {
  const res = await fetch(`${(env.SITE_URL ?? 'https://kordacore.com').replace(/\/$/, '')}/api/budget/cron`, {
    method: 'POST',
    headers: { 'x-cron-secret': env.BUDGET_CRON_SECRET ?? '' },
  });
  // Shows in the Worker's logs.
  console.log(res.status, await res.text());
}
