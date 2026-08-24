// src/features/outreach/hooks/useMessages.ts
//
// Every message the system has ever queued, with what became of it.
//
// The status column on outreach_messages only tells half the story. It records
// what the *sender* did — queued, sent, failed, skipped — and then stops. What
// happened afterwards (a reply, a bounce, an opt-out) arrives days later and
// lives only in outreach_events, keyed by contact rather than by message. So an
// outcome has to be composed from both, and a row that says `sent` may well be
// a row that bounced.
//
// Aggregation is client-side over the current page plus one events query. Fine
// at this scale; past roughly 50k messages the outcome join belongs in a
// Postgres view, same threshold as the analytics hook.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export const MESSAGES_PAGE_SIZE = 40;

/**
 * What actually became of a message, as opposed to what the sender last did to
 * it. Ordered by how much the reader cares: a reply is the point of the whole
 * system, a bounce is the thing that threatens the domain.
 */
export type Outcome =
  | 'replied' | 'bounced' | 'unsubscribed'
  | 'sent' | 'queued' | 'failed' | 'skipped' | 'canceled';

export interface MessageRow {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  status: string;
  step_number: number | null;
  skip_reason: string | null;
  error: string | null;
  sent_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  personalized: boolean;
  personalization_error: string | null;
  campaign_id: string | null;
  contact_id: string;
  identity_id: string | null;

  // Composed, not stored.
  outcome: Outcome;
  campaignName: string;
  identityLabel: string | null;
  businessName: string | null;
  contactName: string | null;
  /** When the reply/bounce/opt-out landed, if one did. */
  outcomeAt: string | null;
}

export interface MessagesFilter {
  outcome?: Outcome | 'all';
  campaignId?: string;
  search?: string;
  page?: number;
}

export interface MessagesPage {
  rows: MessageRow[];
  total: number;
  /** Counts across the whole table, not just this page — drives the filter tabs. */
  counts: Record<string, number>;
}

interface RawMessage {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  status: string;
  step_number: number | null;
  skip_reason: string | null;
  error: string | null;
  sent_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  personalized: boolean;
  personalization_error: string | null;
  campaign_id: string | null;
  contact_id: string;
  identity_id: string | null;
  contacts: {
    full_name: string | null;
    businesses: { name: string } | null;
  } | null;
}

export function useMessages(filter: MessagesFilter) {
  return useQuery({
    queryKey: ['outreach-messages', filter],
    staleTime: 15_000,
    queryFn: async (): Promise<MessagesPage> => {
      const page = filter.page ?? 1;
      const from = (page - 1) * MESSAGES_PAGE_SIZE;
      const to = from + MESSAGES_PAGE_SIZE - 1;

      // Outcome events first: they decide which messages match an outcome
      // filter, so they cannot be fetched after the page has been sliced.
      const [eventsRes, campaignsRes, identitiesRes] = await Promise.all([
        supabase
          .from('outreach_events')
          .select('contact_id,event_type,occurred_at')
          .in('event_type', ['replied', 'bounced', 'unsubscribed'])
          .order('occurred_at', { ascending: false }),
        supabase.from('campaigns').select('id,name'),
        supabase.from('sending_identities').select('id,label'),
      ]);
      for (const r of [eventsRes, campaignsRes, identitiesRes]) {
        if (r.error) throw r.error;
      }

      // Newest event per contact per type. Ordered desc above, so the first
      // one seen for a contact is the one that stands.
      const outcomeByContact = new Map<string, { type: Outcome; at: string }>();
      for (const e of (eventsRes.data ?? []) as
        { contact_id: string | null; event_type: string; occurred_at: string }[]) {
        if (!e.contact_id) continue;
        const existing = outcomeByContact.get(e.contact_id);
        // A reply outranks a bounce outranks an opt-out: if someone answered,
        // that is the fact worth surfacing even if the address later broke.
        const rank = (t: string) => (t === 'replied' ? 3 : t === 'bounced' ? 2 : 1);
        if (!existing || rank(e.event_type) > rank(existing.type)) {
          outcomeByContact.set(e.contact_id, { type: e.event_type as Outcome, at: e.occurred_at });
        }
      }

      const campaignName = new Map(
        ((campaignsRes.data ?? []) as { id: string; name: string }[]).map(c => [c.id, c.name]),
      );
      const identityLabel = new Map(
        ((identitiesRes.data ?? []) as { id: string; label: string }[]).map(i => [i.id, i.label]),
      );

      let query = supabase
        .from('outreach_messages')
        .select(
          'id,to_email,subject,body,status,step_number,skip_reason,error,sent_at,scheduled_at,' +
          'created_at,personalized,personalization_error,campaign_id,contact_id,identity_id,' +
          'contacts(full_name,businesses(name))',
          { count: 'exact' },
        )
        // Newest activity first. sent_at is null for anything not yet sent, and
        // Postgres sorts nulls first on desc, so created_at is the tiebreaker
        // that keeps queued work from burying the history.
        .order('sent_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (filter.campaignId) query = query.eq('campaign_id', filter.campaignId);
      if (filter.search) {
        const term = `%${filter.search}%`;
        query = query.or(`to_email.ilike.${term},subject.ilike.${term}`);
      }

      // An outcome filter cannot be pushed into the query for the three event
      // outcomes — they live in another table keyed by contact. Status-backed
      // outcomes can be, and are, because that keeps the common case paginated
      // in the database.
      const eventOutcomes = new Set(['replied', 'bounced', 'unsubscribed']);
      const isEventFilter = filter.outcome && eventOutcomes.has(filter.outcome);
      if (filter.outcome && filter.outcome !== 'all' && !isEventFilter) {
        query = query.eq('status', filter.outcome);
      }
      if (!isEventFilter) query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const compose = (m: RawMessage): MessageRow => {
        const evt = outcomeByContact.get(m.contact_id);
        // An event only describes this message if the message actually went
        // out. A queued row for a contact who replied on an earlier campaign is
        // still queued, not replied.
        const applies = evt && m.status === 'sent';
        return {
          ...m,
          outcome: (applies ? evt.type : m.status) as Outcome,
          outcomeAt: applies ? evt.at : null,
          campaignName: m.campaign_id ? campaignName.get(m.campaign_id) ?? 'Unknown' : '—',
          identityLabel: m.identity_id ? identityLabel.get(m.identity_id) ?? null : null,
          businessName: m.contacts?.businesses?.name ?? null,
          contactName: m.contacts?.full_name ?? null,
        };
      };

      let rows = ((data ?? []) as unknown as RawMessage[]).map(compose);
      let total = count ?? 0;

      // Event-backed filters are applied and paginated here, since the database
      // could not do it. The unfiltered fetch above is the whole table in that
      // case, which is the cost of the join living in the client.
      if (isEventFilter) {
        rows = rows.filter(r => r.outcome === filter.outcome);
        total = rows.length;
        rows = rows.slice(from, to + 1);
      }

      const counts: Record<string, number> = {};
      for (const [, evt] of outcomeByContact) {
        counts[evt.type] = (counts[evt.type] ?? 0) + 1;
      }

      return { rows, total, counts };
    },
  });
}

/** Every recorded event for one contact, newest first — the detail timeline. */
export function useMessageEvents(contactId: string | null) {
  return useQuery({
    queryKey: ['outreach-message-events', contactId],
    enabled: Boolean(contactId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_events')
        .select('id,event_type,occurred_at,meta')
        .eq('contact_id', contactId as string)
        .order('occurred_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string; event_type: string; occurred_at: string;
        meta: Record<string, unknown> | null;
      }[];
    },
  });
}
