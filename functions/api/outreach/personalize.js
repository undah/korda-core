/**
 * POST /api/outreach/personalize  { contactId, objective, objectiveNotes?, templateId? }
 *
 * Proxies a personalization request to the hosted pipeline. The Claude call has
 * to happen server-side — ANTHROPIC_API_KEY must never reach the browser — and
 * the pipeline is where it lives: it already holds the service-role key needed
 * to read the lead and site material, and adding an npm SDK dependency to this
 * Functions bundle is a bigger, riskier change than the one that took the whole
 * bundle down once already (see send.js, which inlines its own adapters rather
 * than importing a sibling module here).
 *
 * Returns the pipeline's outcome verbatim — `{ ok: true, subject, body, model }`
 * on success, `{ ok: false, reason }` when generation didn't produce something
 * worth sending. Both are 200s: a declined generation is a normal outcome the
 * caller falls back to a template for, not a request error.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.PIPELINE_URL || !env.RUN_TRIGGER_SECRET) {
    return Response.json(
      { error: 'Personalization is not configured (PIPELINE_URL / RUN_TRIGGER_SECRET).' },
      { status: 500 },
    );
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { contactId, objective, objectiveNotes, templateId } = body;
  if (!contactId) return Response.json({ error: 'contactId is required' }, { status: 400 });
  if (!objective) return Response.json({ error: 'objective is required' }, { status: 400 });

  try {
    const res = await fetch(`${env.PIPELINE_URL.replace(/\/$/, '')}/personalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-run-secret': env.RUN_TRIGGER_SECRET,
      },
      body: JSON.stringify({ contactId, objective, objectiveNotes, templateId }),
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
