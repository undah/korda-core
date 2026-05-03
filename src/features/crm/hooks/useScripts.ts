import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { CallScript } from '../types';

async function fetchScripts(): Promise<CallScript[]> {
  const { data, error } = await supabase
    .from('call_scripts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as CallScript[];
}

export function useScripts() {
  return useQuery({ queryKey: ['crm-scripts'], queryFn: fetchScripts });
}

export function useInsertScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: { title: string; content: string; created_by: string }) => {
      const { data, error } = await supabase.from('call_scripts').insert(s).select().single();
      if (error) throw error;
      return data as CallScript;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-scripts'] }),
  });
}

export function useUpdateScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CallScript> & { id: string }) => {
      const { data, error } = await supabase
        .from('call_scripts').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as CallScript;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-scripts'] }),
  });
}

export function useDeleteScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('call_scripts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-scripts'] }),
  });
}
