// src/features/tracker/hooks/useTrackerCheckins.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subDays, addDays } from "date-fns";
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

  // weekly avg loss — use actual date span, not entry count
  const daySpan = sorted.length > 1
    ? (new Date(sorted[sorted.length - 1].log_date).getTime() - new Date(sorted[0].log_date).getTime()) / 86400000
    : 7;
  const avgWeeklyLoss = +(totalLost / Math.max(1, daySpan / 7)).toFixed(2);

  // best week — compare consecutive entries, scale to 7-day equivalent
  let bestWeek = 0;
  for (let i = 1; i < sorted.length; i++) {
    const days = Math.max(1, (new Date(sorted[i].log_date).getTime() - new Date(sorted[i - 1].log_date).getTime()) / 86400000);
    const rate = (sorted[i - 1].weight - sorted[i].weight) / days * 7;
    if (rate > bestWeek) bestWeek = +rate.toFixed(1);
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

// ─── weight projection ─────────────────────────────────────────────────────────
// Shared by the Dashboard chart and the dedicated Graph screen so both project
// the same trajectory from the same 30-day pace.

export function computeWeightProjection(
  sorted: TrackerCheckin[],
  goal: TrackerGoal | null | undefined
): { paceKgPerWeek: number | null; projectedPoints: { date: string; projected: number }[] } {
  if (sorted.length < 2 || !goal?.goal_weight) return { paceKgPerWeek: null, projectedPoints: [] };

  const cutoff30 = subDays(new Date(), 30).toISOString().split("T")[0];
  const last30 = sorted.filter(c => c.log_date >= cutoff30);
  const paceKgPerWeek = last30.length >= 2
    ? +((last30[last30.length - 1].weight - last30[0].weight) /
        ((new Date(last30[last30.length - 1].log_date).getTime() -
          new Date(last30[0].log_date).getTime()) / (7 * 24 * 60 * 60 * 1000))
      ).toFixed(2)
    : null;

  const latest = sorted[sorted.length - 1];
  const goalW = goal.goal_weight;
  const projectedPoints: { date: string; projected: number }[] = [];

  if (paceKgPerWeek && paceKgPerWeek < 0) {
    let w = latest.weight;
    for (let i = 1; i <= 53; i++) {
      const d = addDays(new Date(latest.log_date), i * 7).toISOString().split("T")[0];
      w = +(w + paceKgPerWeek).toFixed(2);
      if (w <= goalW) { projectedPoints.push({ date: d, projected: goalW }); break; }
      projectedPoints.push({ date: d, projected: w });
    }
  }

  return { paceKgPerWeek, projectedPoints };
}
