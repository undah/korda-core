import { supabase } from '@/lib/supabaseClient';
import type { TrainingEntry, TrainingEntryInsert } from '../types';

export async function fetchTrainingEntries(): Promise<TrainingEntry[]> {
  const { data, error } = await supabase
    .from('training_entries')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertTrainingEntry(entry: TrainingEntryInsert): Promise<TrainingEntry> {
  const { data, error } = await supabase
    .from('training_entries')
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadScreenshot(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('screenshots')
    .upload(filename, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('screenshots').getPublicUrl(filename);
  return data.publicUrl;
}
