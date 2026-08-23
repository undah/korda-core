// src/features/outreach/hooks/useAnalytics.ts
//
// Everything the analytics page reads, computed in one place.
//
// Sent volume comes from outreach_messages rather than the `sent` event: the
// message row is what the sender actually transitions, and it carries
// identity_id and campaign_id without a join. Outcomes come from
// outreach_events, because a reply or a bounce arrives long after the message
// row was last touched and only ever exists as an event.
//
// Aggregation is client-side. At this scale (thousands of rows) that is one
// round trip and no database work; past roughly 50k sent it should become a
// Postgres view, since the wire cost stops being free before the arithmetic
// does.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { capToday } from './useIdentities';
import type { SendingIdentity } from '../types';

/** Null days = all time. */
export interface AnalyticsRange {
  days: number | null;
  label: string;
}

export const RANGES: AnalyticsRange[] = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: null, label: 'All time' },
];

export interface DailyPoint {
  /** ISO date, yyyy-mm-dd. */
  date: string;
  label: string;
  sent: number;
  replied: number;
}

export interface CampaignStat {
  id: string;
  name: string;
  sent: number;
  replied: number;
  bounced: number;
  replyRate: number;
}

export interface IdentityStat {
  id: string;
  label: string;
  fromEmail: string;
  sentToday: number;
  capToday: number;
  sentTotal: number;
  bounced: number;
  warming: boolean;
}

export interface OutreachAnalytics {
  sent: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  /** Sent that have not produced a reply, bounce or opt-out. */
  noResponse: number;
  replyRate: number;
  bounceRate: number;
  unsubRate: number;
  daily: DailyPoint[];
  campaigns: CampaignStat[];
  identities: IdentityStat[];
  /** The equivalent window immediately before this one, for the deltas. Null on all-time. */
  previous: { sent: number; replied: number; replyRate: number } | null;
  /** True until at least one message has been sent — drives the empty state. */
  isEmpty: boolean;
}

interface MessageRow {
  id: string;
  campaign_id: string | null;
  identity_id: string | null;
  sent_at: string | null;
}

interface EventRow {
  contact_id: string | null;
  campaign: string | null;
  event_type: string;
  occurred_at: string;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Every day in the window, so gaps render as zero rather than closing up. */
function emptyDays(days: number): Map<string, DailyPoint> {
  const out = new Map<string, DailyPoint>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.set(key, {
      date: key,
      label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      sent: 0,
      replied: 0,
    });
  }
  return out;
}

export function useAnalytics(range: AnalyticsRange) {
  return useQuery({
    queryKey: ['outreach-analytics', range.days],
    staleTime: 30_000,
    queryFn: async (): Promise<OutreachAnalytics> => {
      const since = range.days
        ? new Date(Date.now() - range.days * 86_400_000).toISOString()
        : null;
      // The window of the same length immediately before this one.
      const prevSince = range.days
        ? new Date(Date.now() - 2 * range.days * 86_400_000).toISOString()
        : null;

      let messageQuery = supabase
        .from('outreach_messages')
        .select('id,campaign_id,identity_id,sent_at')
        .eq('status', 'sent')
        .not('sent_at', 'is', null);
      // Pull the previous window too, in one request, and split locally.
      if (prevSince) messageQuery = messageQuery.gte('sent_at', prevSince);

      let eventQuery = supabase
        .from('outreach_events')
        .select('contact_id,campaign,event_type,occurred_at')
        .in('event_type', ['replied', 'bounced', 'unsubscribed']);
      if (prevSince) eventQuery = eventQuery.gte('occurred_at', prevSince);

      const [messages, events, campaigns, identities] = await Promise.all([
        messageQuery,
        eventQuery,
        supabase.from('campaigns').select('id,name'),
        supabase.from('sending_identities').select('*').order('created_at', { ascending: true }),
      ]);

      for (const r of [messages, events, campaigns, identities]) {
        if (r.error) throw r.error;
      }

      const allMessages = (messages.data ?? []) as MessageRow[];
      const allEvents = (events.data ?? []) as EventRow[];
      const campaignRows = (campaigns.data ?? []) as { id: string; name: string }[];
      const identityRows = (identities.data ?? []) as SendingIdentity[];

      const inWindow = <T,>(rows: T[], stamp: (r: T) => string | null) =>
        since ? rows.filter(r => { const s = stamp(r); return s !== null && s >= since; }) : rows;

      const sentRows = inWindow(allMessages, m => m.sent_at);
      const eventRows = inWindow(allEvents, e => e.occurred_at);

      // A contact who replies twice is one reply. Bounces and opt-outs are
      // counted the same way, so every rate shares one denominator and the
      // percentages add up to something meaningful.
      const distinct = (type: string, rows: EventRow[]) =>
        new Set(rows.filter(e => e.event_type === type).map(e => e.contact_id ?? '')).size;

      const sent = sentRows.length;
      const replied = distinct('replied', eventRows);
      const bounced = distinct('bounced', eventRows);
      const unsubscribed = distinct('unsubscribed', eventRows);
      const rate = (n: number) => (sent > 0 ? n / sent : 0);

      // ── daily series ──
      const days = emptyDays(range.days ?? 30);
      for (const m of sentRows) {
        const point = m.sent_at ? days.get(dayKey(m.sent_at)) : undefined;
        if (point) point.sent++;
      }
      // Counted on the day the reply landed, not the day we mailed — this is an
      // activity chart, not a cohort chart, and pretending otherwise would make
      // a reply retroactively change a bar the reader already looked at.
      const repliedSeen = new Set<string>();
      for (const e of eventRows) {
        if (e.event_type !== 'replied') continue;
        const key = `${e.contact_id}`;
        if (repliedSeen.has(key)) continue;
        repliedSeen.add(key);
        const point = days.get(dayKey(e.occurred_at));
        if (point) point.replied++;
      }

      // ── per campaign ──
      const campaignName = new Map(campaignRows.map(c => [c.id, c.name]));
      const byCampaign = new Map<string, CampaignStat>();
      const ensure = (id: string): CampaignStat => {
        let row = byCampaign.get(id);
        if (!row) {
          row = {
            id, name: campaignName.get(id) ?? 'Unknown campaign',
            sent: 0, replied: 0, bounced: 0, replyRate: 0,
          };
          byCampaign.set(id, row);
        }
        return row;
      };
      for (const m of sentRows) if (m.campaign_id) ensure(m.campaign_id).sent++;
      for (const e of eventRows) {
        if (!e.campaign) continue;
        if (e.event_type === 'replied') ensure(e.campaign).replied++;
        if (e.event_type === 'bounced') ensure(e.campaign).bounced++;
      }
      const campaignStats = [...byCampaign.values()]
        .map(c => ({ ...c, replyRate: c.sent > 0 ? c.replied / c.sent : 0 }))
        .sort((a, b) => b.sent - a.sent);

      // ── per mailbox ──
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayIso = startOfToday.toISOString();

      const identityStats: IdentityStat[] = identityRows.map(identity => {
        const mine = allMessages.filter(m => m.identity_id === identity.id);
        return {
          id: identity.id,
          label: identity.label,
          fromEmail: identity.from_email,
          sentToday: mine.filter(m => (m.sent_at ?? '') >= todayIso).length,
          capToday: capToday(identity),
          sentTotal: mine.length,
          bounced: 0,
          warming: capToday(identity) < identity.daily_cap,
        };
      });

      // ── previous window, for the deltas ──
      let previous: OutreachAnalytics['previous'] = null;
      if (since && prevSince) {
        const prevMessages = allMessages.filter(
          m => m.sent_at !== null && m.sent_at >= prevSince && m.sent_at < since,
        );
        const prevEvents = allEvents.filter(
          e => e.occurred_at >= prevSince && e.occurred_at < since,
        );
        const prevSent = prevMessages.length;
        const prevReplied = distinct('replied', prevEvents);
        previous = {
          sent: prevSent,
          replied: prevReplied,
          replyRate: prevSent > 0 ? prevReplied / prevSent : 0,
        };
      }

      return {
        sent,
        replied,
        bounced,
        unsubscribed,
        noResponse: Math.max(0, sent - replied - bounced - unsubscribed),
        replyRate: rate(replied),
        bounceRate: rate(bounced),
        unsubRate: rate(unsubscribed),
        daily: [...days.values()],
        campaigns: campaignStats,
        identities: identityStats,
        previous,
        isEmpty: allMessages.length === 0,
      };
    },
  });
}
