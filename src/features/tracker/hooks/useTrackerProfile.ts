// src/features/tracker/hooks/useTrackerProfile.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface TrackerProfile {
  id: string;
  user_id: string;
  display_name?: string | null;
  height_cm?: number | null;
  age?: number | null;
  gender?: "male" | "female" | "other" | "prefer_not" | null;
  tdee?: number | null;
  created_at: string;
  updated_at: string;
}

export function useTrackerProfile() {
  return useQuery({
    queryKey: ["tracker_profile"],
    queryFn: async (): Promise<TrackerProfile | null> => {
      const { data, error } = await supabase
        .from("tracker_profile")
        .select("*")
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data ?? null;
    },
  });
}

export function useUpsertProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Omit<TrackerProfile, "id" | "user_id" | "created_at" | "updated_at">>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("tracker_profile")
        .upsert({ ...payload, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracker_profile"] }),
  });
}

export function useDeleteAllTrackerData() {
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      // delete in order to respect FK constraints
      await supabase.from("tracker_photos").delete().eq("user_id", user.id);
      await supabase.from("tracker_calories").delete().eq("user_id", user.id);
      await supabase.from("tracker_journal").delete().eq("user_id", user.id);
      await supabase.from("tracker_checkins").delete().eq("user_id", user.id);
      await supabase.from("tracker_goals").delete().eq("user_id", user.id);
      await supabase.from("tracker_profile").delete().eq("user_id", user.id);
    },
  });
}
