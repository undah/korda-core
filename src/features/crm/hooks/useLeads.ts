import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { Lead, LeadInsert, LeadUpdate } from '../types';

export interface LeadsFilter {
  repIds?: string[];
  statuses?: string[];
  dateFrom?: string;
  dateTo?: string;
}

async function fetchLeads(filter: LeadsFilter = {}): Promise<Lead[]> {
  let query = supabase
    .from('leads')
    .select('*')
    .order('datum', { ascending: false })
    .order('tijdstip', { ascending: false });

  if (filter.repIds?.length)   query = query.in('rep_id', filter.repIds);
  if (filter.statuses?.length) query = query.in('status', filter.statuses);
  if (filter.dateFrom)         query = query.gte('datum', filter.dateFrom);
  if (filter.dateTo)           query = query.lte('datum', filter.dateTo);

  const { data, error } = await query;
  if (error) throw error;
  return data as Lead[];
}

export function useLeads(filter: LeadsFilter = {}, refetchInterval?: number) {
  return useQuery({
    queryKey: ['crm-leads', filter],
    queryFn: () => fetchLeads(filter),
    refetchInterval,
  });
}

export function useInsertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead: LeadInsert) => {
      const { data, error } = await supabase.from('leads').insert(lead).select().single();
      if (error) throw error;
      return data as Lead;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-leads'] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: LeadUpdate) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Lead;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-leads'] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-leads'] }),
  });
}
