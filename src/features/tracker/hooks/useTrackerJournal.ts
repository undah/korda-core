// src/features/tracker/hooks/useTrackerJournal.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { TrackerJournal, TrackerCalories, TrackerPhoto } from "../types";

// ─── journal ─────────────────────────────────────────────────────────────────

export function useTrackerJournal(limit = 30) {
  return useQuery({
    queryKey: ["tracker_journal", limit],
    queryFn: async (): Promise<TrackerJournal[]> => {
      const { data, error } = await supabase
        .from("tracker_journal")
        .select("*")
        .order("log_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<TrackerJournal, "id" | "user_id" | "created_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("tracker_journal")
        .upsert({ ...payload, user_id: user.id }, { onConflict: "user_id,log_date" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracker_journal"] }),
  });
}

// ─── calories ────────────────────────────────────────────────────────────────

export function useTrackerCalories(limit = 30) {
  return useQuery({
    queryKey: ["tracker_calories", limit],
    queryFn: async (): Promise<TrackerCalories[]> => {
      const { data, error } = await supabase
        .from("tracker_calories")
        .select("*")
        .order("log_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertCalories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<TrackerCalories, "id" | "user_id" | "created_at" | "deficit">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("tracker_calories")
        .insert({ ...payload, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracker_calories"] }),
  });
}

// ─── photos ──────────────────────────────────────────────────────────────────

export function useTrackerPhotos() {
  return useQuery({
    queryKey: ["tracker_photos"],
    queryFn: async (): Promise<TrackerPhoto[]> => {
      const { data, error } = await supabase
        .from("tracker_photos")
        .select("*")
        .order("log_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      angle,
      log_date,
      weight_at,
    }: {
      file: File;
      angle: "front" | "side" | "back";
      log_date: string;
      weight_at?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop();
      const path = `${user.id}/${log_date}_${angle}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("tracker-photos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("tracker-photos")
        .getPublicUrl(path);

      const { data, error } = await supabase
        .from("tracker_photos")
        .upsert({ user_id: user.id, log_date, angle, url: publicUrl, weight_at }, { onConflict: "user_id,log_date,angle" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracker_photos"] }),
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tracker_photos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracker_photos"] }),
  });
  
}
export function useDeleteJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tracker_journal").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracker_journal"] }),
  });
}

export function useDeleteCalories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tracker_calories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracker_calories"] }),
  });
}