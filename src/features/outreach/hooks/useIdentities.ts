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
/**
 * Mirrors dailyCapForAge in korda-outreach/src/rateLimit.ts, which is the
 * source of truth — claim_send_slot enforces against that, not this.
 *
 * This used to ramp 5 per week while the pipeline stepped by tier, so the
 * console showed 15 for a mailbox the system would actually let send 25. A
 * displayed cap that disagrees with the enforced one is worse than no display:
 * it is the number you plan a campaign around.
 *
 * Kept in sync by hand. The tiers are configurable on the pipeline
 * (WARMUP_* env vars); if they are ever changed there, change them here too.
 */
const TIERS = { rampStart: 5, rampPerDay: 1, week2: 15, week3: 25, mature: 35 };

export function dailyCapForAge(days: number): number {
  const age = Math.max(0, Math.floor(days));
  if (age < 7) return TIERS.rampStart + TIERS.rampPerDay * age;
  if (age < 14) return TIERS.week2;
  if (age < 21) return TIERS.week3;
  return TIERS.mature;
}

export function capToday(identity: SendingIdentity, now = Date.now()): number {
  if (!identity.warmup_started_on) return identity.daily_cap ?? TIERS.mature;
  const started = Date.parse(identity.warmup_started_on);
  if (Number.isNaN(started)) return identity.daily_cap ?? TIERS.mature;

  const curve = dailyCapForAge(Math.floor((now - started) / 86_400_000));
  // An override applies, but never raises the cap above the curve mid-warmup.
  return identity.daily_cap != null ? Math.min(identity.daily_cap, curve) : curve;
}
