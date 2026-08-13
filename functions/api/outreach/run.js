/**
 * POST /api/outreach/run  { slug, maxResultsOverride? }
 *
 * Proxies a run request to the hosted pipeline service. The pipeline can't run
 * here — it crawls real sites for minutes using Node APIs — so it lives as a
 * separate always-on service. This function exists so the browser never learns
 * the pipeline's URL or its shared secret.
 *
 * Returns as soon as the pipeline accepts the job; progress is observed by
 * polling run_log from the console.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.PIPELINE_URL || !env.RUN_TRIGGER_SECRET) {
    return Response.json(
      { error: 'Run triggering is not configured (PIPELINE_URL / RUN_TRIGGER_SECRET).' },
      { status: 500 },
    );
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { slug, maxResultsOverride } = body;
  if (!slug) return Response.json({ error: 'slug is required' }, { status: 400 });

  try {
    const res = await fetch(`${env.PIPELINE_URL.replace(/\/$/, '')}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-run-secret': env.RUN_TRIGGER_SECRET,
      },
      body: JSON.stringify({ slug, maxResultsOverride }),
    });

    const data = await res.json().catch(() => ({}));
    // Pass the pipeline's own status through — 409 "already running" and 404
    // "no such niche" are both useful to surface verbatim in the UI.
    return Response.json(data, { status: res.status });
  } catch (e) {
    return Response.json(
      { error: `Could not reach the pipeline service: ${e?.message ?? 'unknown error'}` },
      { status: 502 },
    );
  }
}
