export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { runs = [], range = "30 days" } = body;

  if (!runs.length) {
    return Response.json({ summary: "No runs found in this period." });
  }

  const totalKm   = runs.reduce((s, r) => s + r.distance, 0) / 1000;
  const totalSecs = runs.reduce((s, r) => s + r.moving_time, 0);
  const avgPaceMps = runs.reduce((s, r) => s + r.average_speed, 0) / runs.length;
  const paceMin = Math.floor(1000 / avgPaceMps / 60);
  const paceSec = Math.round((1000 / avgPaceMps / 60 % 1) * 60);

  const runLines = runs.map(r => {
    const pace = r.average_speed > 0
      ? `${Math.floor(1000 / r.average_speed / 60)}:${String(Math.round((1000 / r.average_speed / 60 % 1) * 60)).padStart(2, "0")} /km`
      : "–";
    const date = r.start_date_local?.slice(0, 10) ?? "?";
    return `${date}: ${(r.distance / 1000).toFixed(2)} km @ ${pace}${r.average_heartrate ? `, HR ${Math.round(r.average_heartrate)} bpm` : ""}${r.total_elevation_gain ? `, elev ${Math.round(r.total_elevation_gain)}m` : ""}`;
  }).join("\n");

  const prompt = `You are a running coach. Analyse the following ${range} of Strava data and write a concise coaching summary (4–6 sentences) covering:
1. Volume and consistency — how many runs, total km, frequency
2. Pace trend — is the athlete getting faster or slower, and by how much?
3. One specific strength visible in the data
4. One actionable suggestion to improve over the next period

Use actual numbers. Be direct and specific. No bullet points or headers — flowing text only.

PERIOD: last ${range}
TOTAL: ${runs.length} runs, ${totalKm.toFixed(1)} km, avg pace ${paceMin}:${String(paceSec).padStart(2, "0")} /km

RUNS (newest first):
${runLines}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return Response.json({ error: `Claude API error: ${res.status}`, detail: err }, { status: 502 });
  }

  const data = await res.json();
  return Response.json({ summary: data?.content?.[0]?.text ?? "" });
}
