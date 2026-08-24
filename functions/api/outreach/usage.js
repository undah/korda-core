/**
 * GET /api/outreach/usage — live provider balances.
 *
 * Only the *balance* comes through here. Consumption history lives in the
 * api_usage table and the console reads that straight from Supabase like any
 * other table, so this endpoint exists purely because HUNTER_API_KEY is on the
 * pipeline host and must not reach the browser.
 *
 * Hunter's /v2/account is the only provider balance worth asking for: it is
 * free to call, and it counts credits spent outside this system too (the Hunter
 * web app, another tool sharing the key), which our own ledger by definition
 * cannot see. Google Places and Anthropic bill in arrears with no balance to
 * read, so for those the ledger is all there is.
 */
export async function onRequestGet(context) {
  const { env } = context;

  if (!env.PIPELINE_URL || !env.RUN_TRIGGER_SECRET) {
    return Response.json(
      { error: 'Usage reporting is not configured (PIPELINE_URL / RUN_TRIGGER_SECRET).' },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${env.PIPELINE_URL.replace(/\/$/, '')}/usage/balance`, {
      headers: { 'x-run-secret': env.RUN_TRIGGER_SECRET },
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
