// src/features/outreach/hooks/useIdentities.ts
// The sending pool. Note what is NOT here: credentials. sending_identities
// stores the *name* of an environment variable, and the Cloudflare send
// function resolves it — so this table is safe to read through the browser's
// anon client in a way an API key never would be.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { SendingIdentity, SendingIdentityDraft } from '../types';

export function useIdentities() {
  return useQuery({
    queryKey: ['outreach-identities'],
    queryFn: async (): Promise<SendingIdentity[]> => {
      const { data, error } = await supabase
        .from('sending_identities').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SendingIdentity[];
    },
    staleTime: 15_000,
  });
}

/** Volume sent per identity today, so the pool page can show real headroom. */
export function useIdentityUsage() {
  return useQuery({
    queryKey: ['outreach-identity-usage'],
    queryFn: async (): Promise<Record<string, number>> => {
      // Local midnight, matching how the sender counts a day.
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('outreach_messages')
        .select('identity_id')
        .eq('status', 'sent')
        .gte('sent_at', start.toISOString())
        .not('identity_id', 'is', null);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { identity_id: string }[]) {
        counts[row.identity_id] = (counts[row.identity_id] ?? 0) + 1;
      }
      return counts;
    },
    staleTime: 15_000,
  });
}

export function useSaveIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...draft }: SendingIdentityDraft & { id?: string }) => {
      const query = id
        ? supabase.from('sending_identities').update(draft).eq('id', id)
        : supabase.from('sending_identities').insert(draft);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach-identities'] });
      qc.invalidateQueries({ queryKey: ['outreach-identity-usage'] });
    },
  });
}

export function useDeleteIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sending_identities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach-identities'] }),
  });
}

/**
 * Today's ceiling for one mailbox — mirrors identityCapToday in the send
 * function so the console shows the same number the sender will enforce.
 */
export function capToday(identity: SendingIdentity, now = Date.now()): number {
  const cap = identity.daily_cap ?? 40;
  if (!identity.warmup_started_on) return cap;
  const started = Date.parse(identity.warmup_started_on);
  if (Number.isNaN(started)) return cap;
  const weeks = Math.floor((now - started) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(cap, 5 + 5 * Math.max(0, weeks));
}
