// src/features/outreach/api.ts
//
// Every call to /api/outreach/* goes through here.
//
// Those endpoints hold server-side secrets and act with them, so
// functions/api/outreach/_middleware.js now requires a live Supabase session.
// Attaching the token by hand at each call site is how one of them eventually
// ships without it, so there is exactly one door.

import { supabase } from "@/lib/supabaseClient";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You are signed out — sign in again to continue.");
  return { Authorization: `Bearer ${token}` };
}

/**
 * fetch() for the outreach API: adds the bearer token, parses the JSON body,
 * and turns a non-2xx into an Error carrying the server's message rather than
 * a bare status code.
 */
export async function outreachFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers as Record<string, string> | undefined),
      ...(await authHeader()),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string })?.error;
    // 401 here means the session expired mid-session, not a permissions bug.
    throw new Error(
      message ??
        (res.status === 401
          ? "Your session expired — sign in again."
          : `Request failed (${res.status})`),
    );
  }
  return data as T;
}

export const outreachPost = <T = unknown>(path: string, body: unknown) =>
  outreachFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
