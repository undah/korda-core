import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

const CLIENT_ID = "261214";

export interface StravaAthlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  profile_medium: string;
  profile: string;
  city: string;
  country: string;
  sex: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  start_latlng: [number, number] | null;
  end_latlng: [number, number] | null;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  map: { id: string; summary_polyline: string | null };
  kudos_count: number;
  achievement_count: number;
  suffer_score?: number;
}

interface StravaTokenRow {
  id: string;
  user_id: string;
  athlete_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete_data: StravaAthlete;
  updated_at: string;
}

async function refreshIfNeeded(token: StravaTokenRow): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (token.expires_at > now + 300) return token.access_token;

  const res = await fetch("/api/strava/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    }),
  });
  const data = await res.json();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("strava_tokens").update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);
  }
  return data.access_token;
}

export function useStravaToken() {
  return useQuery({
    queryKey: ["strava_token"],
    queryFn: async (): Promise<StravaTokenRow | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("strava_tokens")
        .select("*")
        .eq("user_id", user.id)
        .single();
      return data ?? null;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useStravaActivities() {
  const { data: tokenRow } = useStravaToken();

  return useQuery({
    queryKey: ["strava_activities"],
    enabled: !!tokenRow,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<StravaActivity[]> => {
      if (!tokenRow) throw new Error("No token");
      const accessToken = await refreshIfNeeded(tokenRow);

      const all: StravaActivity[] = [];
      let page = 1;
      while (true) {
        const res = await fetch(
          `https://www.strava.com/api/v3/athlete/activities?per_page=100&page=${page}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) throw new Error("Strava API error");
        const batch: StravaActivity[] = await res.json();
        if (!batch.length) break;
        all.push(...batch);
        if (batch.length < 100) break;
        page++;
      }
      return all;
    },
  });
}

export function useConnectStrava() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<void> => {
      const res = await fetch("/api/strava/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
        }),
      });
      const data = await res.json();
      if (!data.access_token) throw new Error(data.message ?? data.error ?? JSON.stringify(data));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase.from("strava_tokens").upsert({
        user_id: user.id,
        athlete_id: data.athlete.id,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        athlete_data: data.athlete,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["strava_token"] });
      qc.invalidateQueries({ queryKey: ["strava_activities"] });
      toast.success("Strava connected!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDisconnectStrava() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await supabase.from("strava_tokens").delete().eq("user_id", user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["strava_token"] });
      qc.invalidateQueries({ queryKey: ["strava_activities"] });
      toast.success("Strava disconnected");
    },
  });
}

export function getStravaAuthUrl(): string {
  const redirectUri = `${window.location.origin}/tracker/strava`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "activity:read_all",
    approval_prompt: "auto",
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}
