import { supabase } from '@/lib/supabaseClient';
import type { TrainingEntry, TrainingEntryInsert, Mistake, MistakeInsert, ConceptEntry, ConceptEntryInsert } from '../types';

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

export async function fetchMistakes(): Promise<Mistake[]> {
  const { data, error } = await supabase
    .from('mistakes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertMistake(entry: MistakeInsert): Promise<Mistake> {
  const { data, error } = await supabase
    .from('mistakes')
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMistake(id: string, updates: Partial<MistakeInsert>): Promise<Mistake> {
  const { data, error } = await supabase
    .from('mistakes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMistake(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('mistakes')
    .delete()
    .eq('id', id)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Delete blocked — check table permissions.');
}

export async function bulkDeleteMistakes(ids: string[]): Promise<void> {
  const { data, error } = await supabase
    .from('mistakes')
    .delete()
    .in('id', ids)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Bulk delete blocked — check table permissions.');
}

export async function bulkInsertMistakes(entries: MistakeInsert[]): Promise<Mistake[]> {
  const { data, error } = await supabase
    .from('mistakes')
    .insert(entries)
    .select();
  if (error) throw error;
  return data ?? [];
}

// ── Concept Journal ────────────────────────────────────────────────────────────

export async function fetchConceptEntries(): Promise<ConceptEntry[]> {
  const { data, error } = await supabase
    .from('concept_journal')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertConceptEntry(entry: ConceptEntryInsert): Promise<ConceptEntry> {
  const { data, error } = await supabase
    .from('concept_journal')
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateConceptEntry(id: string, updates: Partial<ConceptEntryInsert>): Promise<ConceptEntry> {
  const { data, error } = await supabase
    .from('concept_journal')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteConceptEntry(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('concept_journal')
    .delete()
    .eq('id', id)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Delete blocked — check table permissions.');
}

export async function bulkDeleteConceptEntries(ids: string[]): Promise<void> {
  const { data, error } = await supabase
    .from('concept_journal')
    .delete()
    .in('id', ids)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Bulk delete blocked — check table permissions.');
}

export async function bulkInsertConceptEntries(entries: ConceptEntryInsert[]): Promise<ConceptEntry[]> {
  const { data, error } = await supabase
    .from('concept_journal')
    .insert(entries)
    .select();
  if (error) throw error;
  return data ?? [];
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

export async function bulkUpdateTrainingEntries(
  ids: string[],
  updates: Partial<TrainingEntryInsert>
): Promise<TrainingEntry[]> {
  const { data, error } = await supabase
    .from('training_entries')
    .update(updates)
    .in('id', ids)
    .select();
  if (error) throw error;
  return data ?? [];
}

export async function bulkDeleteTrainingEntries(ids: string[]): Promise<void> {
  const { data, error } = await supabase
    .from('training_entries')
    .delete()
    .in('id', ids)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Bulk delete blocked — check table permissions.');
}
