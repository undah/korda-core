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

  const { checkins = [], journal = [], goal = null } = body;

  const goalLine = goal?.goal_weight
    ? `Your goal weight is ${goal.goal_weight} kg (weekly target: ${goal.weekly_target ?? "not set"} kg/week).`
    : "No specific goal has been set yet.";

  const checkinLines = checkins.length
    ? checkins.map(c => `${c.log_date}: ${c.weight} kg${c.waist ? `, waist ${c.waist}cm` : ""}${c.notes ? ` — notes: "${c.notes}"` : ""}`).join("\n")
    : "No check-ins this week.";

  const journalLines = journal.length
    ? journal.map(j => [
        `${j.log_date}:`,
        j.mood    ? `  mood: ${j.mood}` : "",
        j.energy  ? `  energy: ${j.energy}` : "",
        j.sleep_hrs ? `  sleep: ${j.sleep_hrs}h` : "",
        j.wins    ? `  wins: ${j.wins}` : "",
        j.struggles ? `  struggles: ${j.struggles}` : "",
        j.notes   ? `  notes: ${j.notes}` : "",
      ].filter(Boolean).join("\n")).join("\n\n")
    : "No journal entries this week.";

  const prompt = `You are a supportive fitness coach reviewing a client's past week of data. Write a concise, encouraging weekly summary (3–4 sentences) that:
- Notes what the data shows (weight trend, any measurements)
- Highlights a win or positive pattern
- Gives one specific, actionable suggestion for next week
- Keeps a warm, direct tone — no fluff, no excessive praise

${goalLine}

CHECK-INS THIS WEEK:
${checkinLines}

JOURNAL ENTRIES THIS WEEK:
${journalLines}

Write the summary now (plain text, no headers, no bullet points):`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
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
