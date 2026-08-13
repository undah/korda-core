// src/features/outreach/hooks/useOutreach.ts
// All outreach data access. Uses the Suite's authed anon client — RLS decides
// what the signed-in user can see. There is deliberately no service-role key here.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import {
  LEADS_PAGE_SIZE,
  type Business,
  type Contact,
  type LeadsFilter,
  type Niche,
  type NicheDraft,
  type OutreachReadyRow,
  type RunLogEntry,
  type SuppressionEntry,
} from '../types';

// ── leads (outreach_ready view) ───────────────────────────────────────────────

export interface LeadsPage {
  rows: OutreachReadyRow[];
  total: number;
}

export function useLeads(filter: LeadsFilter) {
  return useQuery({
    queryKey: ['outreach-leads', filter],
    queryFn: async (): Promise<LeadsPage> => {
      const page = filter.page ?? 1;
      const from = (page - 1) * LEADS_PAGE_SIZE;
      const to = from + LEADS_PAGE_SIZE - 1;

      let query = supabase
        .from('outreach_ready')
        .select('*', { count: 'exact' })
        .order('confidence', { ascending: false })
        .range(from, to);

      if (filter.niche) query = query.eq('niche', filter.niche);
      if (filter.emailStatus) query = query.eq('email_status', filter.emailStatus);
      if (filter.minConfidence) query = query.gte('confidence', filter.minConfidence);
      if (filter.search) {
        const term = `%${filter.search}%`;
        query = query.or(
          `business_name.ilike.${term},full_name.ilike.${term},email.ilike.${term}`,
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as OutreachReadyRow[], total: count ?? 0 };
    },
  });
}

// ── niches ────────────────────────────────────────────────────────────────────

/**
 * `provider` and `osm_filters` were added after the original schema. Fill them
 * in on read so the UI behaves sanely against an un-migrated database instead
 * of treating an absent provider as "not google" and showing the wrong form.
 */
function normaliseNiche(row: Partial<Niche>): Niche {
  return {
    ...(row as Niche),
    provider: row.provider ?? 'google',
    osm_filters: row.osm_filters ?? [],
    search_queries: row.search_queries ?? [],
  };
}

export function useNiches() {
  return useQuery({
    queryKey: ['outreach-niches'],
    queryFn: async (): Promise<Niche[]> => {
      const { data, error } = await supabase.from('niches').select('*').order('name');
      if (error) throw error;
      return ((data ?? []) as Partial<Niche>[]).map(normaliseNiche);
    },
  });
}

export function useNiche(id: string | undefined) {
  return useQuery({
    queryKey: ['outreach-niche', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Niche | null> => {
      const { data, error } = await supabase.from('niches').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? normaliseNiche(data as Partial<Niche>) : null;
    },
  });
}

/** Lead counts per niche slug, for the niches overview. */
export function useNicheLeadCounts() {
  return useQuery({
    queryKey: ['outreach-niche-counts'],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from('outreach_ready').select('niche');
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { niche: string | null }[]) {
        if (!row.niche) continue;
        counts[row.niche] = (counts[row.niche] ?? 0) + 1;
      }
      return counts;
    },
  });
}

export function useUpdateNiche() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Niche> & { id: string }) => {
      const { data, error } = await supabase
        .from('niches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Niche;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach-niches'] });
      qc.invalidateQueries({ queryKey: ['outreach-niche'] });
    },
  });
}

export function useCreateNiche() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: NicheDraft) => {
      const { data, error } = await supabase.from('niches').insert(draft).select().single();
      if (error) throw error;
      return data as Niche;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach-niches'] }),
  });
}

export function useDeleteNiche() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('niches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach-niches'] }),
  });
}

// ── business detail ───────────────────────────────────────────────────────────

export function useBusiness(id: string | undefined) {
  return useQuery({
    queryKey: ['outreach-business', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Business | null> => {
      const { data, error } = await supabase.from('businesses').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return (data as Business | null) ?? null;
    },
  });
}

export function useBusinessContacts(businessId: string | undefined) {
  return useQuery({
    queryKey: ['outreach-business-contacts', businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<Contact[]> => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('business_id', businessId)
        .order('confidence', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contact> & { id: string }) => {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach-business-contacts'] });
      qc.invalidateQueries({ queryKey: ['outreach-leads'] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach-business-contacts'] });
      qc.invalidateQueries({ queryKey: ['outreach-leads'] });
    },
  });
}

// ── runs ──────────────────────────────────────────────────────────────────────

export function useRuns() {
  return useQuery({
    queryKey: ['outreach-runs'],
    queryFn: async (): Promise<RunLogEntry[]> => {
      const { data, error } = await supabase
        .from('run_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as RunLogEntry[];
    },
    // A run takes minutes and writes its result straight to run_log, so poll
    // while one is open and fall idle again once everything has finished.
    refetchInterval: query => {
      const rows = query.state.data as RunLogEntry[] | undefined;
      return rows?.some(r => r.finished_at === null) ? 4000 : false;
    },
  });
}

/**
 * Ask the hosted pipeline to run a niche. The request goes through our own
 * Cloudflare function, which holds the pipeline URL and shared secret.
 */
export function useTriggerRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { slug: string; maxResultsOverride?: number }) => {
      const res = await fetch('/api/outreach/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Run request failed (${res.status})`);
      return data as { accepted: boolean; slug: string; maxResults?: number };
    },
    onSuccess: () => {
      // Give the pipeline a moment to open its run_log row, then start polling.
      setTimeout(() => qc.invalidateQueries({ queryKey: ['outreach-runs'] }), 1200);
    },
  });
}

// ── suppression ───────────────────────────────────────────────────────────────

export function useSuppression() {
  return useQuery({
    queryKey: ['outreach-suppression'],
    queryFn: async (): Promise<SuppressionEntry[]> => {
      const { data, error } = await supabase
        .from('suppression_list')
        .select('*')
        .order('added_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SuppressionEntry[];
    },
  });
}

export interface SuppressInput {
  email?: string;
  domain?: string;
  reason?: string;
}

export function useAddSuppression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, domain, reason }: SuppressInput) => {
      const { error } = await supabase.from('suppression_list').insert({
        email: email ? email.toLowerCase() : null,
        domain: domain ? domain.toLowerCase() : null,
        reason: reason ?? 'manual',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach-suppression'] });
      // Suppressing removes rows from outreach_ready, so leads must refetch.
      qc.invalidateQueries({ queryKey: ['outreach-leads'] });
      qc.invalidateQueries({ queryKey: ['outreach-niche-counts'] });
    },
  });
}

export function useRemoveSuppression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppression_list').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach-suppression'] });
      qc.invalidateQueries({ queryKey: ['outreach-leads'] });
    },
  });
}
