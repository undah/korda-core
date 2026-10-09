// src/features/budget/lib/bankApi.ts — the one door to /api/budget/*.
// Those routes act with the service role and the bank key, so each call carries
// the user's session; functions/api/budget/_middleware.js checks it.
import { supabase } from "@/lib/supabaseClient";

/** `pad` is relative to /api/budget/bank/; a path starting with "/" is used as is. */
export async function bankFetch<T>(pad: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Je bent uitgelogd. Log opnieuw in.");
  let res: Response;
  try {
    res = await fetch(pad.startsWith("/") ? pad : `/api/budget/bank/${pad}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Geen verbinding. Probeer het zo nog eens.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Er ging iets mis (${res.status})`);
  return json as T;
}

export type SyncUitkomst = { nieuw: number; bijgewerkt: number; fouten: Array<{ rekening: string; fout: string }> };
