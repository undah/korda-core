// src/features/outreach/hooks/usePersonalize.ts
// AI personalization: the offer profile (settings), asking Claude to write one
// email, and sending it immediately outside of a campaign. The actual model
// call happens on the pipeline host — this file only ever talks to Supabase
// (profile, the Direct sends campaign) and the two Cloudflare proxies
// (/api/outreach/personalize, /api/outreach/send-now).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { Objective, OutreachProfile } from '../types';

// ── offer profile ────────────────────────────────────────────────────────────

const EMPTY_PROFILE: Omit<OutreachProfile, 'id' | 'updated_at'> = {
  company_name: '', offer: '', proof_points: '', tone: '', language: 'nl',
  sender_name: '', constraints: '',
};

/** Singleton by convention — the settings page only ever edits one row. */
export function useOutreachProfile() {
  return useQuery({
    queryKey: ['outreach-profile'],
    queryFn: async (): Promise<OutreachProfile | null> => {
      const { data, error } = await supabase
        .from('outreach_profile').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return (data as OutreachProfile | null) ?? null;
    },
    staleTime: 15_000,
  });
}

export function useSaveOutreachProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string } & Partial<Omit<OutreachProfile, 'id' | 'updated_at'>>) => {
      const { id, ...fields } = input;
      const query = id
        ? supabase.from('outreach_profile').update(fields).eq('id', id)
        : supabase.from('outreach_profile').insert({ ...EMPTY_PROFILE, ...fields });
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach-profile'] }),
  });
}

// ── generation ────────────────────────────────────────────────────────────────

export type PersonalizeOutcome =
  | { ok: true; subject: string; body: string; model: string }
  | { ok: false; reason: string };

/**
 * Ask the pipeline to write one email. Never throws on a declined generation —
 * that's a normal outcome (`ok: false`) the caller falls back to a template
 * for — but a network/config failure on the proxy itself does throw, since
 * that's not something the caller can sensibly fall back from silently.
 */
export function useGeneratePersonalization() {
  return useMutation({
    mutationFn: async (input: {
      contactId: string;
      objective: Objective;
      objectiveNotes?: string | null;
      templateId?: string | null;
    }): Promise<PersonalizeOutcome> => {
      const res = await fetch('/api/outreach/personalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Personalization failed (${res.status})`);
      return data as PersonalizeOutcome;
    },
  });
}

// ── upfront campaign generation ─────────────────────────────────────────────

export interface UpfrontProgress {
  done: number;
  total: number;
}

export interface UpfrontResult {
  personalized: number;
  failed: number;
}

/**
 * Generate every message in a just-created campaign, one at a time.
 *
 * Sequential rather than parallel — this runs from the browser at campaign
 * creation, and a burst of concurrent requests against the pipeline's single
 * Claude client has no benefit (Anthropic's own concurrency limits would just
 * queue them) and makes `onProgress` report in the wrong order. Every message
 * already carries valid rendered-template content from `useCreateCampaign`, so
 * a failure here is a no-op, not a missing email — the template stands.
 *
 * Only called for campaigns at or below PERSONALIZE_UPFRONT_MAX; above that,
 * the scheduler personalizes at send time instead (see scheduler.ts on the
 * pipeline and the "at-send" note on the campaign builder).
 */
export function useUpfrontPersonalize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      campaignId: string;
      objective: Objective;
      objectiveNotes?: string | null;
      onProgress?: (p: UpfrontProgress) => void;
    }): Promise<UpfrontResult> => {
      const { data: messages, error: msgError } = await supabase
        .from('outreach_messages')
        .select('id,contact_id,step_number')
        .eq('campaign_id', input.campaignId)
        .eq('status', 'queued');
      if (msgError) throw msgError;

      const { data: steps, error: stepError } = await supabase
        .from('sequence_steps').select('step_number,template_id').eq('campaign_id', input.campaignId);
      if (stepError) throw stepError;
      const templateByStep = new Map(
        ((steps ?? []) as { step_number: number; template_id: string | null }[])
          .map(s => [s.step_number, s.template_id]),
      );

      const rows = (messages ?? []) as { id: string; contact_id: string; step_number: number }[];
      let personalized = 0;
      let failed = 0;

      for (let i = 0; i < rows.length; i++) {
        const msg = rows[i];
        try {
          const res = await fetch('/api/outreach/personalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contactId: msg.contact_id,
              objective: input.objective,
              objectiveNotes: input.objectiveNotes ?? null,
              templateId: templateByStep.get(msg.step_number) ?? null,
            }),
          });
          const outcome = (await res.json().catch(() => ({}))) as PersonalizeOutcome;

          if (res.ok && 'ok' in outcome && outcome.ok) {
            const { error: updateError } = await supabase
              .from('outreach_messages')
              .update({
                subject: outcome.subject, body: outcome.body,
                personalized: true, personalization_model: outcome.model,
                personalization_error: null,
              })
              .eq('id', msg.id);
            if (updateError) throw updateError;
            personalized++;
          } else {
            const reason = 'ok' in outcome && !outcome.ok ? outcome.reason : `HTTP ${res.status}`;
            await supabase
              .from('outreach_messages').update({ personalization_error: reason }).eq('id', msg.id);
            failed++;
          }
        } catch (e) {
          await supabase
            .from('outreach_messages')
            .update({ personalization_error: e instanceof Error ? e.message : 'Generation failed' })
            .eq('id', msg.id);
          failed++;
        }
        input.onProgress?.({ done: i + 1, total: rows.length });
      }

      return { personalized, failed };
    },
    onSuccess: (_result, input) => {
      qc.invalidateQueries({ queryKey: ['outreach-campaign-messages', input.campaignId] });
    },
  });
}

// ── individual sends ─────────────────────────────────────────────────────────

const DIRECT_CAMPAIGN_NAME = 'Direct sends';

/**
 * One shared campaign every individually-sent message attaches to, rather than
 * a parallel send path. Every guard in /api/outreach/send — suppression,
 * do-not-contact, replies, duplicate address, daily caps — lives in one place
 * this way; a second path would have to reimplement all of them, and one
 * missed guard is how you email someone who unsubscribed.
 */
async function getOrCreateDirectCampaignId(): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from('campaigns').select('id').eq('name', DIRECT_CAMPAIGN_NAME).limit(1).maybeSingle();
  if (findError) throw findError;
  if (existing) return (existing as { id: string }).id;

  const { data: created, error: createError } = await supabase
    .from('campaigns')
    .insert({ name: DIRECT_CAMPAIGN_NAME, status: 'sending' })
    .select('id').single();
  if (createError) throw createError;
  return (created as { id: string }).id;
}

export interface SendDirectInput {
  contactId: string;
  nicheId: string | null;
  toEmail: string;
  subject: string;
  body: string;
  objective: Objective;
  personalized: boolean;
  personalizationModel?: string | null;
  /** Null lets send.js auto-pick from the pool. A chosen identity is honoured
   * exactly — see the "pick a mailbox" guard in functions/api/outreach/send.js,
   * which never silently reassigns a deliberate choice. */
  identityId?: string | null;
}

export interface SendDirectResult {
  sent: number;
  skipped: number;
  failed: number;
}

/** Queue one message on the Direct sends campaign, then send it immediately. */
export function useSendDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendDirectInput): Promise<SendDirectResult> => {
      const campaignId = await getOrCreateDirectCampaignId();

      const { data: message, error: insertError } = await supabase
        .from('outreach_messages')
        .insert({
          campaign_id: campaignId,
          contact_id: input.contactId,
          niche_id: input.nicheId,
          to_email: input.toEmail,
          step_number: 1,
          subject: input.subject,
          body: input.body,
          status: 'queued',
          scheduled_at: null,
          objective: input.objective,
          personalized: input.personalized,
          personalization_model: input.personalizationModel ?? null,
          identity_id: input.identityId ?? null,
        })
        .select('id').single();
      if (insertError) throw insertError;

      const res = await fetch('/api/outreach/send-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: [(message as { id: string }).id] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Send failed (${res.status})`);
      return data as SendDirectResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach-business-contacts'] });
      qc.invalidateQueries({ queryKey: ['outreach-leads'] });
      qc.invalidateQueries({ queryKey: ['outreach-campaigns'] });
    },
  });
}
