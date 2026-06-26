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

  const { checkins = [], journal = [], goal = null, runs = [], range = "30d" } = body;

  const goalLine = goal?.goal_weight
    ? `Goal: reach ${goal.goal_weight} kg (weekly target: ${goal.weekly_target ?? "not set"} kg/week).`
    : "No specific goal set.";

  const checkinLines = checkins.length
    ? checkins.map(c =>
        `${c.log_date}: ${c.weight} kg${c.waist ? `, waist ${c.waist}cm` : ""}${c.notes ? ` — "${c.notes}"` : ""}`
      ).join("\n")
    : "No weight check-ins in this period.";

  const journalLines = journal.length
    ? journal.map(j => [
        `${j.log_date}:`,
        j.mood      ? `  mood: ${j.mood}`           : "",
        j.energy    ? `  energy: ${j.energy}`        : "",
        j.sleep_hrs ? `  sleep: ${j.sleep_hrs}h`    : "",
        j.wins      ? `  wins: ${j.wins}`            : "",
        j.struggles ? `  struggles: ${j.struggles}`  : "",
      ].filter(Boolean).join("\n")).join("\n\n")
    : "No journal entries in this period.";

  const runLines = runs.length
    ? runs.map(r => {
        const pace = r.average_speed > 0
          ? `${Math.floor(1000 / r.average_speed / 60)}:${String(Math.round((1000 / r.average_speed / 60 % 1) * 60)).padStart(2, "0")} /km`
          : "–";
        return `${r.start_date_local?.slice(0, 10)}: ${(r.distance / 1000).toFixed(2)} km @ ${pace}${r.average_heartrate ? `, HR ${Math.round(r.average_heartrate)} bpm` : ""}`;
      }).join("\n")
    : "No Strava runs linked.";

  const prompt = `You are a personal fitness and health coach reviewing ${range} of data for a client. Write a thorough but concise analysis (5–7 sentences) structured around these points:

1. Weight trend — what's the overall direction, rate of change, and consistency?
2. Training — how is the running volume and pace evolving?
3. Lifestyle — what patterns stand out in mood, energy, and sleep?
4. Key win — what's the most notable positive from this period?
5. One priority — the single most impactful thing to focus on next.

Keep the tone direct, specific, and encouraging. Use actual numbers from the data. No bullet points or headers — flowing paragraphs only.

${goalLine}

WEIGHT CHECK-INS:
${checkinLines}

JOURNAL ENTRIES:
${journalLines}

STRAVA RUNS:
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
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return Response.json({ error: `Claude API error: ${res.status}`, detail: err }, { status: 502 });
  }

  const data = await res.json();
  const summary = data?.content?.[0]?.text ?? "";
  return Response.json({ summary });
}
