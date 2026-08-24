import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';
import {
  MESSAGES_PAGE_SIZE, useMessageEvents, useMessages,
} from '@/features/outreach/hooks/useMessages';
import type { MessageRow, Outcome } from '@/features/outreach/hooks/useMessages';

/* Same validated light-surface palette as Analytics and Usage. */
const INK = { good: '#006300', warn: '#8a5a00', bad: '#b3261e', dim: '#56554f', faint: '#86847d' };

/**
 * How each outcome reads. Colour never carries this alone — every pill shows
 * the word too, which is what makes the column scannable in grayscale and for
 * a reader who cannot separate the green from the red.
 */
const OUTCOME: Record<Outcome, { label: string; color: string; note?: string }> = {
  replied: { label: 'replied', color: INK.good, note: 'They answered. Follow-ups were cancelled.' },
  bounced: { label: 'bounced', color: INK.bad, note: 'Address rejected it permanently and was suppressed.' },
  unsubscribed: { label: 'unsubscribed', color: INK.warn, note: 'They opted out. Never contact again.' },
  sent: { label: 'sent', color: INK.dim, note: 'Delivered, no response yet.' },
  queued: { label: 'queued', color: INK.faint, note: 'Waiting for its turn in the send window.' },
  failed: { label: 'failed', color: INK.bad, note: 'The send itself errored — see the reason.' },
  skipped: { label: 'skipped', color: INK.faint, note: 'A guard stopped it before sending.' },
  canceled: { label: 'canceled', color: INK.faint, note: 'Called off, usually because they replied.' },
};

const TABS: { key: Outcome | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'replied', label: 'Replied' },
  { key: 'sent', label: 'Sent' },
  { key: 'queued', label: 'Queued' },
  { key: 'bounced', label: 'Bounced' },
  { key: 'unsubscribed', label: 'Opted out' },
  { key: 'failed', label: 'Failed' },
  { key: 'skipped', label: 'Skipped' },
];

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '—';

function OutcomePill({ outcome }: { outcome: Outcome }) {
  const o = OUTCOME[outcome] ?? OUTCOME.sent;
  return (
    <span className="o-pill" style={{ color: o.color, borderColor: `${o.color}44` }}>
      <span className="o-pill-dot" style={{ background: o.color }} />
      {o.label}
    </span>
  );
}

function MessageDetail({ message, onClose }: { message: MessageRow; onClose: () => void }) {
  const { data: events } = useMessageEvents(message.contact_id);
  const o = OUTCOME[message.outcome] ?? OUTCOME.sent;

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-8">{message.subject}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <OutcomePill outcome={message.outcome} />
            {message.personalized && (
              <span className="o-pill" style={{ color: '#1b31c4', borderColor: '#2743f044' }}>
                ai written
              </span>
            )}
            {message.step_number !== null && message.step_number > 1 && (
              <span className="o-pill">step {message.step_number}</span>
            )}
          </div>
          {o.note && <p className="text-xs text-muted-foreground">{o.note}</p>}

          <div className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            {[
              ['To', message.to_email],
              ['Business', message.businessName ?? '—'],
              ['Contact', message.contactName ?? 'No name on record'],
              ['Campaign', message.campaignName],
              ['Sent from', message.identityLabel ?? 'Not yet assigned'],
              ['Sent at', when(message.sent_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-[var(--o-hairline-2)] pb-1.5">
                <span className="outreach-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">{k}</span>
                <span className="text-right">{v}</span>
              </div>
            ))}
          </div>

          {(message.error || message.skip_reason) && (
            <div className="o-panel p-3" style={{ borderColor: '#d03b3b44' }}>
              <div className="outreach-mono text-[0.65rem] uppercase tracking-wider" style={{ color: INK.bad }}>
                {message.error ? 'Send error' : 'Skip reason'}
              </div>
              <p className="mt-1 text-xs">{message.error ?? message.skip_reason}</p>
            </div>
          )}

          {message.personalization_error && (
            <p className="text-[0.7rem] text-muted-foreground">
              AI generation declined ({message.personalization_error}) — the rendered template
              was sent instead.
            </p>
          )}

          <div>
            <div className="outreach-mono mb-1.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              Body as sent
            </div>
            <div className="o-panel max-h-64 overflow-y-auto whitespace-pre-wrap p-3 text-xs leading-relaxed">
              {message.body}
            </div>
          </div>

          {events && events.length > 0 && (
            <div>
              <div className="outreach-mono mb-1.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                Everything recorded for this contact
              </div>
              <div className="space-y-1">
                {events.map(e => (
                  <div key={e.id} className="flex items-center justify-between text-xs">
                    <span>{e.event_type}</span>
                    <span className="outreach-mono text-[0.7rem] text-muted-foreground">
                      {when(e.occurred_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function OutreachMessages() {
  // Deep-linked from a campaign page, which shows only recent activity and
  // sends you here for the full history rather than duplicating this view.
  const [params, setParams] = useSearchParams();
  const campaignId = params.get('campaign') ?? undefined;
  const [tab, setTab] = useState<Outcome | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<MessageRow | null>(null);

  const { data, isLoading, error } = useMessages({
    outcome: tab, search: search.trim() || undefined, page, campaignId,
  });

  if (error) return <ErrorState error={error} />;

  const rows = data?.rows ?? [];
  const campaignName = campaignId ? rows[0]?.campaignName : undefined;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / MESSAGES_PAGE_SIZE));

  const select = (key: Outcome | 'all') => { setTab(key); setPage(1); };

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Messages"
        sub="Every email the system has queued or sent, and what became of it."
      />

      {campaignId && (
        <div className="o-panel mb-4 flex items-center justify-between p-3">
          <span className="text-xs text-muted-foreground">
            Filtered to one campaign{campaignName ? ` — ${campaignName}` : ''}
          </span>
          <button className="text-xs"
            style={{ color: '#1b31c4', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => { setParams({}); setPage(1); }}>
            Show all campaigns
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div style={{ display: 'flex', border: '1px solid var(--o-hairline)', borderRadius: 3, overflow: 'hidden' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => select(t.key)}
              style={{
                padding: '0.4rem 0.7rem', border: 'none', cursor: 'pointer',
                fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
                letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.62rem',
                background: t.key === tab ? '#2743f0' : '#fff',
                color: t.key === tab ? '#fff' : INK.dim,
              }}>
              {t.label}
              {t.key !== 'all' && data?.counts[t.key] ? ` ${data.counts[t.key]}` : ''}
            </button>
          ))}
        </div>
        <Input
          className="h-8 w-56 text-xs"
          placeholder="Search address or subject…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading ? (
        <EmptyState title="Loading messages…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title={tab === 'all' ? 'No messages yet.' : `Nothing ${tab}.`}
          hint={tab === 'all' ? 'Queue a campaign or send to a lead directly.' : undefined}
        />
      ) : (
        <>
          <div className="o-panel">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Sent / due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(m => (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => setOpen(m)}>
                    <TableCell>
                      <div className="text-sm">{m.businessName ?? m.to_email}</div>
                      <div className="outreach-mono text-[0.68rem] text-muted-foreground">{m.to_email}</div>
                    </TableCell>
                    <TableCell className="max-w-[22rem]">
                      <div className="truncate text-sm">{m.subject}</div>
                      {m.personalized && (
                        <span className="outreach-mono text-[0.62rem]" style={{ color: '#1b31c4' }}>
                          ai written
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.campaignName}</TableCell>
                    <TableCell><OutcomePill outcome={m.outcome} /></TableCell>
                    <TableCell className="outreach-mono text-[0.7rem] text-muted-foreground">
                      {/* A queued message carries a future scheduled_at. Printing
                          it bare under a "Sent" heading read as though a message
                          had been sent on a date that has not happened yet. */}
                      {m.sent_at
                        ? when(m.sent_at)
                        : m.scheduled_at
                          ? `due ${when(m.scheduled_at)}`
                          : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="outreach-mono text-[0.68rem] text-muted-foreground">
              {total} message{total === 1 ? '' : 's'} · page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="ghost" size="sm" disabled={page >= pages}
                onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      {/*
        No opens column, and that is deliberate rather than missing. A tracking
        pixel needs consent under ePrivacy Art. 5(3) — legitimate interest, which
        the rest of this system relies on, is not available for it — Apple Mail
        preloads images so the number would be mostly noise, and a remote 1x1 is
        a spam signal on a young domain. Decided with the user; don't add one
        back without revisiting all three.
      */}
      {open && <MessageDetail message={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
