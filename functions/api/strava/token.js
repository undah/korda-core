export async function onRequestPost(context) {
  const { request, env } = context;

  const clientSecret = env.VITE_STRAVA_CLIENT_SECRET;
  if (!clientSecret) {
    return Response.json({ error: "VITE_STRAVA_CLIENT_SECRET not configured" }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { grant_type, code, refresh_token } = body;

  const payload = {
    client_id: "261214",
    client_secret: clientSecret,
    grant_type,
    ...(grant_type === "authorization_code" ? { code } : { refresh_token }),
  };

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    return Response.json(data, { status: res.status });
  }
  return Response.json(data);
}
