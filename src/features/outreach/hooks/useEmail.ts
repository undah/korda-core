// src/features/outreach/hooks/useEmail.ts
// Email manager data access. Queuing happens client-side through the authed
// anon client (RLS-guarded); the actual send runs in /api/outreach/send, which
// holds the Resend key and the service-role key server-side.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type {
  Campaign, EmailTemplate, OutreachMessage, OutreachReadyRow, SendResult,
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

/** Create a campaign and queue one rendered message per selected lead. */
export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      template: EmailTemplate;
      recipients: OutreachReadyRow[];
    }): Promise<Campaign> => {
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .insert({ name: input.name, template_id: input.template.id, status: 'draft' })
        .select().single();
      if (error) throw error;

      const created = campaign as Campaign;
      // Enforced here rather than trusting the caller: queueing is the only way
      // a message is ever created, so this is the one place that can guarantee a
      // campaign never contains the same business or address twice.
      const messages = dedupeRecipients(input.recipients).map(lead => ({
        campaign_id: created.id,
        contact_id: lead.contact_id,
        to_email: lead.email,
        subject: renderTemplate(input.template.subject, lead),
        body: renderTemplate(input.template.body, lead),
        status: 'queued',
      }));

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
export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string): Promise<SendResult> => {
      const totals: SendResult = { sent: 0, skipped: 0, failed: 0, remaining: 0, done: false };

      for (let pass = 0; pass < 40; pass++) {
        const res = await fetch('/api/outreach/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail?.error ?? `Send failed (${res.status})`);
        }
        const batch = (await res.json()) as SendResult;
        totals.sent += batch.sent;
        totals.skipped += batch.skipped;
        totals.failed += batch.failed;
        totals.remaining = batch.remaining;
        totals.done = batch.done;
        if (batch.done) break;
      }
      return totals;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      qc.invalidateQueries({ queryKey: ['outreach-campaign-messages'] });
      qc.invalidateQueries({ queryKey: ['outreach-leads'] });
    },
  });
}
