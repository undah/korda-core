// src/features/tracker/hooks/useTrackerCheckins.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { TrackerCheckin, TrackerGoal, ProgressStats } from "../types";

// ─── checkins ────────────────────────────────────────────────────────────────

export function useTrackerCheckins(limit = 90) {
  return useQuery({
    queryKey: ["tracker_checkins", limit],
    queryFn: async (): Promise<TrackerCheckin[]> => {
      const { data, error } = await supabase
        .from("tracker_checkins")
        .select("*")
        .order("log_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<TrackerCheckin, "id" | "user_id" | "created_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("tracker_checkins")
        .upsert({ ...payload, user_id: user.id }, { onConflict: "user_id,log_date" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracker_checkins"] }),
  });
}

export function useDeleteCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tracker_checkins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracker_checkins"] }),
  });
}

// ─── goals ───────────────────────────────────────────────────────────────────

export function useTrackerGoal() {
  return useQuery({
    queryKey: ["tracker_goal"],
    queryFn: async (): Promise<TrackerGoal | null> => {
      const { data, error } = await supabase
        .from("tracker_goals")
        .select("*")
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data ?? null;
    },
  });
}

export function useUpsertGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Omit<TrackerGoal, "id" | "user_id" | "created_at" | "updated_at">>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("tracker_goals")
        .upsert({ ...payload, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracker_goal"] }),
  });
}

// ─── derived stats ────────────────────────────────────────────────────────────

export function useProgressStats(): ProgressStats | null {
  const { data: checkins } = useTrackerCheckins(90);
  const { data: goal } = useTrackerGoal();

  if (!checkins || checkins.length === 0) return null;

  const sorted = [...checkins].sort(
    (a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime()
  );

  const latest = sorted[sorted.length - 1].weight;
  const earliest = sorted[0].weight;
  const totalLost = +(earliest - latest).toFixed(1);

  // streak — consecutive days with a checkin
  let streak = 0;
  const today = new Date();
  for (let i = sorted.length - 1; i >= 0; i--) {
    const d = new Date(sorted[i].log_date);
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (diff === streak) streak++;
    else break;
  }

  // weekly avg loss
  const weeks = Math.max(1, Math.round(sorted.length / 7));
  const avgWeeklyLoss = +(totalLost / weeks).toFixed(2);

  // best week
  let bestWeek = 0;
  for (let i = 7; i < sorted.length; i++) {
    const lost = sorted[i - 7].weight - sorted[i].weight;
    if (lost > bestWeek) bestWeek = +lost.toFixed(1);
  }

  // percent to goal
  const startW = goal?.start_weight ?? earliest;
  const goalW  = goal?.goal_weight;
  const totalNeeded = goalW ? startW - goalW : null;
  const percentToGoal = totalNeeded && totalNeeded > 0
    ? Math.min(100, Math.round((totalLost / totalNeeded) * 100))
    : 0;

  // days to goal
  const remaining = goalW ? latest - goalW : null;
  const daysToGoal = remaining && avgWeeklyLoss > 0
    ? Math.round((remaining / avgWeeklyLoss) * 7)
    : null;

  return { totalLost, percentToGoal, currentStreak: streak, avgWeeklyLoss, daysToGoal, bestWeek };
}
