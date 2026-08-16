// src/features/outreach/hooks/useEmail.ts
// Email manager data access. Queuing happens client-side through the authed
// anon client (RLS-guarded); the actual send runs in /api/outreach/send, which
// holds the Resend key and the service-role key server-side.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type {
  Campaign, EmailTemplate, Objective, OutreachMessage, OutreachReadyRow, SendResult,
} from '../types';

// ── merge fields ──────────────────────────────────────────────────────────────

/**
 * Render a template against one lead. Rendered at queue time and stored on the
 * message, so what you previewed is exactly what goes out even if the template
 * is edited later.
 */
export function renderTemplate(text: string, lead: OutreachReadyRow): string {
  const full = lead.full_name?.trim() ?? '';
  const first = full ? full.split(/\s+/)[0] : '';
  // Falls back to "there" so a missing name never renders as "Hi ,"
  const values: Record<string, string> = {
    first_name: first || 'there',
    full_name: full || 'there',
    business_name: lead.business_name ?? '',
    domain: lead.domain ?? '',
    role: lead.role ?? '',
    city: (lead.formatted_address ?? '').split(',').slice(-2, -1)[0]?.replace(/\d{4}\s*[A-Z]{2}\s*/, '').trim() ?? '',
  };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => values[key] ?? '');
}

export const MERGE_FIELDS = ['first_name', 'full_name', 'business_name', 'domain', 'role', 'city'] as const;

// ── recipient de-duplication ──────────────────────────────────────────────────

/**
 * Reduce leads to one message per business, never reusing an address.
 *
 * A lead is one *contact*, not one company, and the same company reaches us
 * twice over:
 *  - enrichment keeps every address it finds, so one business can surface as
 *    several leads (`Garage van der Wind` has verkoop@, werkplaats@ and info@);
 *  - Places lists some companies as two separate places that share an address
 *    (`Watertaxi Rotterdam` and `Watertaxi - SS Rotterdam (56)` are both
 *    info@watertaxirotterdam.nl), so deduping on business alone is not enough.
 *
 * Either one mails the same person twice in a single send, which is how a
 * sending domain gets burned. Highest confidence wins; ties keep the earlier
 * lead so the caller's ordering survives.
 */
export function dedupeRecipients(leads: OutreachReadyRow[]): OutreachReadyRow[] {
  const byConfidence = [...leads].sort((a, b) => b.confidence - a.confidence);

  const seenBusiness = new Set<string>();
  const seenEmail = new Set<string>();
  const kept: OutreachReadyRow[] = [];

  for (const lead of byConfidence) {
    const email = lead.email.trim().toLowerCase();
    if (seenBusiness.has(lead.business_id) || seenEmail.has(email)) continue;
    seenBusiness.add(lead.business_id);
    seenEmail.add(email);
    kept.push(lead);
  }
  return kept;
}

// ── templates ─────────────────────────────────────────────────────────────────

export function useTemplates() {
  return useQuery({
    queryKey: ['outreach-templates'],
    queryFn: async (): Promise<EmailTemplate[]> => {
      const { data, error } = await supabase
        .from('email_templates').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as EmailTemplate[];
    },
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: { id?: string; name: string; subject: string; body: string }) => {
      const { id, ...fields } = t;
      const query = id
        ? supabase.from('email_templates').update(fields).eq('id', id)
        : supabase.from('email_templates').insert(fields);
      const { data, error } = await query.select().single();
      if (error) throw error;
      return data as EmailTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach-templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach-templates'] }),
  });
}

// ── campaigns ─────────────────────────────────────────────────────────────────

export interface CampaignWithStats extends Campaign {
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['outreach-campaigns'],
    queryFn: async (): Promise<CampaignWithStats[]> => {
      const { data: campaigns, error } = await supabase
        .from('campaigns').select('*').order('created_at', { ascending: false });
      if (error) throw error;

      const { data: messages, error: mErr } = await supabase
        .from('outreach_messages').select('campaign_id,status');
      if (mErr) throw mErr;

      const rows = (messages ?? []) as { campaign_id: string; status: string }[];
      return ((campaigns ?? []) as Campaign[]).map(c => {
        const mine = rows.filter(m => m.campaign_id === c.id);
        const count = (s: string) => mine.filter(m => m.status === s).length;
        return {
          ...c,
          queued: count('queued'),
          sent: count('sent'),
          failed: count('failed'),
          skipped: count('skipped'),
          total: mine.length,
        };
      });
    },
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['outreach-campaign', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Campaign | null> => {
      const { data, error } = await supabase.from('campaigns').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return (data as Campaign | null) ?? null;
    },
  });
}

export function useCampaignMessages(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['outreach-campaign-messages', campaignId],
    enabled: Boolean(campaignId),
    queryFn: async (): Promise<OutreachMessage[]> => {
      const { data, error } = await supabase
        .from('outreach_messages').select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OutreachMessage[];
    },
  });
}

/**
 * Edit one still-queued message — reviewing an upfront-generated email before
 * the campaign starts, or fixing one Claude got wrong. Only meaningful while
 * `status = 'queued'`: once sending begins the row is history, not a draft.
 */
export function useUpdateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string; campaignId: string;
      subject: string; body: string;
      personalized?: boolean;
      personalizationModel?: string | null;
    }) => {
      const patch: Record<string, unknown> = { subject: input.subject, body: input.body };
      if (input.personalized !== undefined) {
        patch.personalized = input.personalized;
        patch.personalization_model = input.personalizationModel ?? null;
        patch.personalization_error = null;
      }
      const { error } = await supabase.from('outreach_messages').update(patch).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_r, input) => {
      qc.invalidateQueries({ queryKey: ['outreach-campaign-messages', input.campaignId] });
    },
  });
}

/**
 * Create a campaign and queue every step for every selected lead.
 *
 * All steps are rendered and inserted now rather than generated as the sequence
 * progresses. That keeps the existing promise that what you previewed is what
 * goes out even if a template is edited later, lets the whole sequence be
 * reviewed before committing, and keeps rendering in one place — the sender
 * never has to know about merge fields.
 *
 * Every message starts with `scheduled_at = null`, meaning "not due". Starting
 * the campaign stamps step 1; each send stamps the step after it. So a draft is
 * inert no matter what else goes wrong.
 *
 * Every message also always gets valid rendered-template content, even when
 * `personalize: 'full'` is requested — that's the fallback a declined or
 * not-yet-run generation falls back to, at upfront-generation time or at
 * send time. A campaign is never one failed AI call away from sending nothing.
 */
export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      steps: { template: EmailTemplate; delay_days: number }[];
      recipients: OutreachReadyRow[];
      objective: Objective;
      objectiveNotes?: string | null;
      personalize: 'off' | 'full';
    }): Promise<Campaign> => {
      if (input.steps.length === 0) throw new Error('A campaign needs at least one step.');

      const { data: campaign, error } = await supabase
        .from('campaigns')
        // template_id still points at step 1, so anything reading the campaign
        // without knowing about steps keeps working.
        .insert({
          name: input.name, template_id: input.steps[0].template.id, status: 'draft',
          objective: input.objective, objective_notes: input.objectiveNotes ?? null,
          personalize: input.personalize,
        })
        .select().single();
      if (error) throw error;

      const created = campaign as Campaign;

      const { error: sErr } = await supabase.from('sequence_steps').insert(
        input.steps.map((step, i) => ({
          campaign_id: created.id,
          step_number: i + 1,
          template_id: step.template.id,
          // The first mail goes out when the campaign starts, by definition.
          delay_days: i === 0 ? 0 : step.delay_days,
        })),
      );
      if (sErr) throw sErr;

      // outreach_ready exposes the niche slug; the messages table wants the id,
      // so the daily cap can count per niche without a three-table join.
      const { data: niches } = await supabase.from('niches').select('id,slug');
      const nicheIdBySlug = new Map(
        ((niches ?? []) as { id: string; slug: string }[]).map(n => [n.slug, n.id]),
      );

      // Enforced here rather than trusting the caller: queueing is the only way
      // a message is ever created, so this is the one place that can guarantee a
      // campaign never contains the same business or address twice.
      const recipients = dedupeRecipients(input.recipients);
      const messages = recipients.flatMap(lead =>
        input.steps.map((step, i) => ({
          campaign_id: created.id,
          contact_id: lead.contact_id,
          niche_id: lead.niche ? nicheIdBySlug.get(lead.niche) ?? null : null,
          to_email: lead.email,
          step_number: i + 1,
          subject: renderTemplate(step.template.subject, lead),
          body: renderTemplate(step.template.body, lead),
          status: 'queued',
          scheduled_at: null,
        })),
      );

      if (messages.length) {
        const { error: mErr } = await supabase.from('outreach_messages').insert(messages);
        if (mErr) throw mErr;
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach-campaigns'] });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach-campaigns'] }),
  });
}

/**
 * Drive the server-side sender. It works in batches (Cloudflare request time
 * limits), so loop until it reports nothing queued left.
 */
/**
 * Start or pause a campaign.
 *
 * This replaces a browser loop that drained the whole queue as fast as it
 * could. Sending is now paced by the scheduler on the pipeline host: it only
 * sends inside business hours, a couple at a time, and follow-ups land days
 * apart — none of which can be driven from a page the user might close.
 *
 * Starting stamps `scheduled_at` on step 1 so it becomes due; later steps are
 * activated as the step before them sends. Pausing just flips the status — the
 * scheduler re-reads it every tick and stops picking the campaign up.
 */
export function useCampaignControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, action }: {
      campaignId: string;
      action: 'start' | 'pause';
    }): Promise<void> => {
      if (action === 'pause') {
        const { error } = await supabase
          .from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
        if (error) throw error;
        return;
      }

      // Make step 1 due. Only messages still queued and not yet scheduled, so
      // resuming a paused campaign never re-stamps work already in flight.
      const { error: mErr } = await supabase
        .from('outreach_messages')
        .update({ scheduled_at: new Date().toISOString() })
        .eq('campaign_id', campaignId)
        .eq('step_number', 1)
        .eq('status', 'queued')
        .is('scheduled_at', null);
      if (mErr) throw mErr;

      const { error } = await supabase
        .from('campaigns').update({ status: 'sending' }).eq('id', campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      qc.invalidateQueries({ queryKey: ['outreach-campaign'] });
      qc.invalidateQueries({ queryKey: ['outreach-campaign-messages'] });
      qc.invalidateQueries({ queryKey: ['outreach-leads'] });
    },
  });
}
