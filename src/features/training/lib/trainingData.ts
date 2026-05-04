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

export async function updateTrainingEntry(
  id: string,
  updates: Partial<TrainingEntryInsert>
): Promise<TrainingEntry> {
  const { data, error } = await supabase
    .from('training_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTrainingEntry(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('training_entries')
    .delete()
    .eq('id', id)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Delete blocked — run: ALTER TABLE training_entries DISABLE ROW LEVEL SECURITY');
}

export async function bulkInsertTrainingEntries(
  entries: TrainingEntryInsert[]
): Promise<TrainingEntry[]> {
  const { data, error } = await supabase
    .from('training_entries')
    .insert(entries)
    .select();
  if (error) throw error;
  return data ?? [];
}
