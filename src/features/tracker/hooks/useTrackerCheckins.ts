// src/features/tracker/hooks/useTrackerCheckins.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subDays, addDays, parseISO, format, differenceInCalendarDays } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { TrackerCheckin, TrackerGoal, ProgressStats } from "../types";

/** Local calendar date as "YYYY-MM-DD". Never use toISOString() for this — it
 *  converts to UTC first, which lands on the wrong day either side of midnight. */
export const formatISODate = (d: Date) => format(d, "yyyy-MM-dd");

/** `limit` on these hooks is a ROW count, not a number of days. Pages that show
 *  full history share this so nobody silently truncates the oldest data. */
export const ALL_CHECKINS = 2000;

// ─── checkins ────────────────────────────────────────────────────────────────

export function useTrackerCheckins(limit = 90, enabled = true) {
  return useQuery({
    enabled,
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
    mutationFn: async (payload: Omit<TrackerCheckin, "id" | "user_id" | "created_at" | "fat_mass_kg" | "lean_mass_kg">) => {
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

  const sorted = [...checkins].sort((a, b) => a.log_date.localeCompare(b.log_date));

  const latest = sorted[sorted.length - 1].weight;
  const earliest = sorted[0].weight;
  const totalLost = +(earliest - latest).toFixed(1);

  // Streak — consecutive calendar days with a check-in.
  //
  // Anchored to today OR yesterday: a day you simply haven't weighed in on yet
  // must not zero a running streak (the old version required today's entry to
  // exist before it would count anything at all). Dates are de-duplicated so
  // two check-ins on one day count once, and compared as local calendar days —
  // new Date("YYYY-MM-DD") parses as UTC midnight, which shifted the diff by a
  // day for anyone west of Greenwich.
  const days = [...new Set(sorted.map(c => c.log_date))].sort();
  const todayStr = formatISODate(new Date());
  const yesterdayStr = formatISODate(subDays(new Date(), 1));
  let streak = 0;
  if (days.length) {
    const last = days[days.length - 1];
    if (last === todayStr || last === yesterdayStr) {
      streak = 1;
      for (let i = days.length - 1; i > 0; i--) {
        if (days[i - 1] === formatISODate(subDays(parseISO(days[i]), 1))) streak++;
        else break;
      }
    }
  }

  // weekly avg loss — use actual date span, not entry count
  const daySpan = sorted.length > 1
    ? differenceInCalendarDays(parseISO(sorted[sorted.length - 1].log_date), parseISO(sorted[0].log_date))
    : 7;
  const avgWeeklyLoss = +(totalLost / Math.max(1, daySpan / 7)).toFixed(2);

  // best week — compare consecutive entries, scale to 7-day equivalent
  let bestWeek = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = Math.max(1, differenceInCalendarDays(parseISO(sorted[i].log_date), parseISO(sorted[i - 1].log_date)));
    const rate = (sorted[i - 1].weight - sorted[i].weight) / gap * 7;
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

  const cutoff30 = formatISODate(subDays(new Date(), 30));
  const last30 = sorted.filter(c => c.log_date >= cutoff30);
  const spanWeeks = last30.length >= 2
    ? differenceInCalendarDays(parseISO(last30[last30.length - 1].log_date), parseISO(last30[0].log_date)) / 7
    : 0;
  const paceKgPerWeek = spanWeeks > 0
    ? +((last30[last30.length - 1].weight - last30[0].weight) / spanWeeks).toFixed(2)
    : null;

  const latest = sorted[sorted.length - 1];
  const goalW = goal.goal_weight;
  const projectedPoints: { date: string; projected: number }[] = [];

  if (paceKgPerWeek && paceKgPerWeek < 0) {
    let w = latest.weight;
    for (let i = 1; i <= 53; i++) {
      const d = formatISODate(addDays(parseISO(latest.log_date), i * 7));
      w = +(w + paceKgPerWeek).toFixed(2);
      if (w <= goalW) { projectedPoints.push({ date: d, projected: goalW }); break; }
      projectedPoints.push({ date: d, projected: w });
    }
  }

  return { paceKgPerWeek, projectedPoints };
}
