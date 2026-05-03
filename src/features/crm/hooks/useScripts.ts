import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { Script, ScriptInsert, ScriptUpdate } from '../types';

export function useScripts() {
  return useQuery({
    queryKey: ['crm-scripts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Script[];
    },
  });
}

export function useInsertScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (script: ScriptInsert) => {
      const { data, error } = await supabase.from('scripts').insert(script).select().single();
      if (error) throw error;
      return data as Script;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-scripts'] }),
  });
}

export function useUpdateScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: ScriptUpdate) => {
      const { data, error } = await supabase
        .from('scripts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Script;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-scripts'] }),
  });
}

export function useDeleteScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scripts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-scripts'] }),
  });
}
