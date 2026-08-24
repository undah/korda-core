import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useCampaign, useCampaignControl, useCampaignInsight, useCampaignMessages, useUpdateMessage,
} from '@/features/outreach/hooks/useEmail';
import type { CampaignInsight } from '@/features/outreach/hooks/useEmail';
import { useGeneratePersonalization } from '@/features/outreach/hooks/usePersonalize';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';
import { errorMessage } from '@/features/outreach/errors';
import type { Campaign, OutreachMessage } from '@/features/outreach/types';

/* Text-grade steps from the shared palette — these render as words, not fills. */
const INK = { good: '#006300', warn: '#8a5a00', bad: '#b3261e', dim: '#56554f' };
const ACCENT = '#1b31c4';

function formatTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

const OUTCOME_INK: Record<string, string> = {
  replied: INK.good, bounced: INK.bad, unsubscribed: INK.warn,
  failed: INK.bad, sent: INK.dim,
};

function OutcomePill({ value }: { value: string }) {
  const color = OUTCOME_INK[value];
  if (!color) return <span className="o-pill">{value}</span>;
  return (
    <span className="o-pill" style={{ color, borderColor: `${color}44` }}>
      <span className="o-pill-dot" style={{ background: color }} />
      {value}
    </span>
  );
}

function Stat({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="o-panel p-3">
      <div className="outreach-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[0.68rem] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/**
 * One contact's whole conversation, not one email.
 *
 * A follow-up is the same conversation as the email it chases, and listing it
 * as its own row said nothing new while doubling the length of the list — at
 * 40-50 sends a day with follow-ups on, that is the difference between a
 * readable page and an unreadable one. The thread is the unit here; the
 * individual emails live inside it.
 */
interface Thread {
  contactId: string;
  email: string;
  messages: OutreachMessage[];
  /** Most recent activity — what the row leads with. */
  latest: OutreachMessage;
  /** The next thing that will actually happen, if anything. */
  nextQueued: OutreachMessage | null;
  outcome: string;
  /** Sort key: when this conversation last did anything, or will next. */
  at: string;
}

const stampOf = (m: OutreachMessage) => m.sent_at ?? m.scheduled_at ?? m.created_at;

function buildThreads(rows: OutreachMessage[], insight: CampaignInsight | undefined): Thread[] {
  const byContact = new Map<string, OutreachMessage[]>();
  for (const m of rows) {
    const list = byContact.get(m.contact_id);
    if (list) list.push(m);
    else byContact.set(m.contact_id, [m]);
  }

  return [...byContact.entries()]
    .map(([contactId, msgs]) => {
      const messages = [...msgs].sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0));
      const sentOrDone = messages.filter(m => m.status !== 'queued');
      const latest = sentOrDone.length
        ? sentOrDone[sentOrDone.length - 1]
        : messages[messages.length - 1];
      const nextQueued = messages.find(m => m.status === 'queued') ?? null;

      // The contact's outcome wins over any single message's status: someone who
      // replied is replied, whichever email they were answering.
      const evt = insight?.outcomes.get(contactId);
      const outcome = evt && sentOrDone.some(m => m.status === 'sent')
        ? evt.type
        : latest.status;

      return {
        contactId,
        email: latest.to_email,
        messages,
        latest,
        nextQueued,
        outcome,
        at: stampOf(latest),
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Which step earns the replies — the one question this page can answer that
 * the Messages list cannot.
 *
 * A reply belongs to a contact, not to a step, so it is credited to the last
 * step that actually reached them before they answered. That is the step that
 * did the work; crediting step 1 for a reply to step 3 would make every
 * follow-up look useless.
 */
function stepBreakdown(rows: OutreachMessage[], insight: CampaignInsight | undefined) {
  const steps = [...new Set(rows.map(m => m.step_number))].sort((a, b) => a - b);
  return steps.map(step => {
    const atStep = rows.filter(m => m.step_number === step);
    const replied = atStep.filter(m => {
      const evt = insight?.outcomes.get(m.contact_id);
      if (!evt || evt.type !== 'replied' || m.status !== 'sent' || !m.sent_at) return false;
      if (m.sent_at > evt.at) return false;
      const laterStepAlsoLanded = rows.some(
        o => o.contact_id === m.contact_id && o.status === 'sent' && o.sent_at
          && o.sent_at <= evt.at && o.step_number > m.step_number,
      );
      return !laterStepAlsoLanded;
    }).length;

    return {
      step,
      sent: atStep.filter(m => m.status === 'sent').length,
      queued: atStep.filter(m => m.status === 'queued').length,
      replied,
    };
  });
}

/**
 * The conversation, and — where one is still queued — the ability to edit it
 * before it goes.
 *
 * Sent emails are summarised rather than reproduced: their body and full event
 * history are on the Messages page, and duplicating that here was this
 * dialog's original problem.
 */
function ThreadDialog({ thread, campaign, insight, onClose }: {
  thread: Thread;
  campaign: Campaign;
  insight: CampaignInsight | undefined;
  onClose: () => void;
}) {
  const update = useUpdateMessage();
  const generate = useGeneratePersonalization();
  const editing = thread.nextQueued;

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (editing) { setSubject(editing.subject); setBody(editing.body); }
  }, [editing]);

  const evt = insight?.outcomes.get(thread.contactId);

  const handleRegenerate = async () => {
    if (!editing) return;
    try {
      const result = await generate.mutateAsync({
        contactId: thread.contactId,
        objective: editing.objective ?? campaign.objective,
        objectiveNotes: (editing.step_number ?? 1) > 1
          ? 'This is a short follow-up to an earlier email that went unanswered. ' +
            'Reference briefly that you wrote before, do not repeat the original pitch, ' +
            'and keep it to two or three sentences.'
          : null,
      });
      if (result.ok) {
        setSubject(result.subject);
        setBody(result.body);
        toast.success('Regenerated — save to keep it.');
      } else {
        toast.error(`Claude didn't produce an email: ${result.reason}`);
      }
    } catch (e) {
      toast.error(errorMessage(e, 'Regeneration failed.'));
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      await update.mutateAsync({
        id: editing.id, campaignId: editing.campaign_id, subject, body,
        personalized: editing.personalized || undefined,
      });
      toast.success('Saved.');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save that message.'));
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{thread.email}</DialogTitle>
          <DialogDescription>
            {thread.messages.length} email{thread.messages.length === 1 ? '' : 's'} in this conversation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <OutcomePill value={thread.outcome} />
            {evt && (
              <span className="text-[0.7rem] text-muted-foreground">
                {evt.type} {formatTime(evt.at)}
              </span>
            )}
          </div>

          {/* The conversation in order. One line each — enough to see what has
              been said and what is still coming, without reprinting it. */}
          <div className="space-y-1.5">
            {thread.messages.map(m => (
              <div key={m.id}
                className="flex items-center gap-2 border-b border-[var(--o-hairline-2)] pb-1.5 text-xs">
                <span className="outreach-mono w-5 shrink-0 text-muted-foreground">
                  {m.step_number ?? 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.subject}</span>
                {m.personalized && (
                  <span className="outreach-mono shrink-0 text-[0.6rem]" style={{ color: ACCENT }}>ai</span>
                )}
                <span className="outreach-mono shrink-0 text-[0.65rem]"
                  style={{ color: OUTCOME_INK[m.status] ?? INK.dim }}>
                  {m.status}
                </span>
                <span className="outreach-mono shrink-0 text-[0.65rem] text-muted-foreground">
                  {m.sent_at ? formatTime(m.sent_at) : m.scheduled_at ? `due ${formatTime(m.scheduled_at)}` : '—'}
                </span>
              </div>
            ))}
          </div>

          {(thread.latest.error || thread.latest.skip_reason) && (
            <p className="text-xs" style={{ color: INK.bad }}>
              {thread.latest.error ?? thread.latest.skip_reason}
            </p>
          )}

          {editing ? (
            <div className="space-y-3 rounded border p-3">
              <div className="outreach-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground">
                Still queued — editable until it sends
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-subject">Subject</Label>
                <Input id="m-subject" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-body">Body</Label>
                <Textarea id="m-body" rows={8} className="font-mono text-sm"
                  value={body} onChange={e => setBody(e.target.value)} />
              </div>
            </div>
          ) : (
            <Link to="/outreach/messages" className="text-xs" style={{ color: ACCENT }}>
              Read the bodies as sent in Messages →
            </Link>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {editing ? (
            <Button variant="outline" size="sm" disabled={generate.isPending}
              onClick={() => void handleRegenerate()}>
              {generate.isPending ? 'Generating…' : 'Regenerate with Claude'}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            {editing && (
              <Button disabled={update.isPending} onClick={() => void handleSave()}>
                {update.isPending ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OutreachCampaign() {
  const { id } = useParams<{ id: string }>();
  const { data: campaign, isLoading, error } = useCampaign(id);
  const { data: messages } = useCampaignMessages(id);
  const { data: insight } = useCampaignInsight(id);
  const control = useCampaignControl();
  const [openThread, setOpenThread] = useState<Thread | null>(null);

  const rows = messages ?? [];
  const queued = rows.filter(m => m.status === 'queued').length;
  const sent = rows.filter(m => m.status === 'sent').length;
  const failed = rows.filter(m => m.status === 'failed').length;
  const personalized = rows.filter(m => m.personalized).length;
  const running = campaign?.status === 'sending';

  // Counted per contact, not per message: someone who got three emails and
  // answered once is one reply, and a rate built the other way flatters itself.
  const contacted = new Set(rows.filter(m => m.status === 'sent').map(m => m.contact_id));
  const outcomeCount = (type: string) =>
    [...contacted].filter(c => insight?.outcomes.get(c)?.type === type).length;
  const replied = outcomeCount('replied');
  const bounced = outcomeCount('bounced');
  const replyRate = contacted.size > 0 ? replied / contacted.size : 0;

  const breakdown = stepBreakdown(rows, insight);
  const threads = buildThreads(rows, insight);
  const recent = threads.slice(0, 15);
  const nextDue = rows
    .filter(m => m.status === 'queued' && m.scheduled_at)
    .map(m => m.scheduled_at as string)
    .sort()[0] ?? null;

  const handleControl = async (action: 'start' | 'pause') => {
    if (!id) return;
    try {
      await control.mutateAsync({ campaignId: id, action });
      toast.success(
        action === 'start'
          ? 'Campaign started — sending is paced over business hours.'
          : 'Campaign paused.',
      );
    } catch (e) {
      toast.error(errorMessage(e, `Could not ${action} the campaign.`));
    }
  };

  if (error) return <ErrorState error={error} />;
  if (isLoading) return <EmptyState title="Loading campaign…" />;
  if (!campaign) return <EmptyState title="That campaign doesn't exist." />;

  return (
    <div>
      <Link to="/outreach/campaigns" className="text-xs text-muted-foreground hover:text-foreground">
        ← Back to campaigns
      </Link>

      <div className="mt-3">
        <PageHeader
          eyebrow="Campaign"
          title={campaign.name}
          sub={
            `Status: ${campaign.status}` +
            (campaign.personalize === 'full' ? ` · ${personalized}/${rows.length} personalized` : '') +
            (nextDue ? ` · next send ${formatTime(nextDue)}` : '')
          }
          actions={
            running ? (
              <Button variant="outline" disabled={control.isPending}
                onClick={() => void handleControl('pause')}>
                {control.isPending ? 'Pausing…' : 'Pause'}
              </Button>
            ) : queued > 0 ? (
              <Button disabled={control.isPending} onClick={() => void handleControl('start')}>
                {control.isPending ? 'Starting…' : campaign.status === 'paused' ? 'Resume' : 'Start sending'}
              </Button>
            ) : undefined
          }
        />
        {running && (
          <p className="mt-2 text-xs text-muted-foreground">
            Sending is paced by the pipeline — a couple at a time during Dutch business hours, with
            follow-ups days apart. You can close this page; it keeps going.
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Sent" value={String(sent)}
            sub={`${contacted.size} contact${contacted.size === 1 ? '' : 's'}`} />
          <Stat label="Replied" value={String(replied)} color={replied > 0 ? INK.good : undefined}
            sub={contacted.size > 0 ? `${(replyRate * 100).toFixed(1)}% reply rate` : undefined} />
          <Stat label="Bounced" value={String(bounced)} color={bounced > 0 ? INK.bad : undefined} />
          <Stat label="Queued" value={String(queued)}
            sub={nextDue ? `next ${formatTime(nextDue)}` : 'nothing due'} />
          <Stat label="Failed" value={String(failed)} color={failed > 0 ? INK.bad : undefined} />
        </div>
      )}

      {/*
        Only for a real sequence. In the Direct sends bucket step_number is not a
        step at all but an unbounded per-contact counter, so this table grew a
        row per number and would reach hundreds at real volume — each reporting
        a single send. There is no step to compare against there, so the whole
        comparison is meaningless rather than merely noisy.
      */}
      {insight?.hasSequence && breakdown.length > 1 && (
        <div className="o-panel mb-4 p-4">
          <div className="mb-1 text-sm">By step</div>
          <p className="mb-3 text-xs text-muted-foreground">
            A reply is credited to the last step that reached the contact before they answered.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Step</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Queued</TableHead>
                <TableHead className="text-right">Replied</TableHead>
                <TableHead className="text-right">Reply rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.map(b => (
                <TableRow key={b.step}>
                  <TableCell className="o-num text-xs">{b.step}</TableCell>
                  <TableCell className="o-num text-right text-xs">{b.sent}</TableCell>
                  <TableCell className="o-num text-right text-xs text-muted-foreground">{b.queued}</TableCell>
                  <TableCell className="o-num text-right text-xs"
                    style={b.replied > 0 ? { color: INK.good } : undefined}>{b.replied}</TableCell>
                  <TableCell className="o-num text-right text-xs text-muted-foreground">
                    {b.sent > 0 ? `${((b.replied / b.sent) * 100).toFixed(0)}%` : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No messages in this campaign." />
      ) : (
        <div className="o-panel">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="text-sm">Conversations</div>
              <p className="text-xs text-muted-foreground">
                One row per contact — follow-ups are inside, not beside.
                {threads.length > recent.length && ` Latest ${recent.length} of ${threads.length}.`}
              </p>
            </div>
            <Link to={`/outreach/messages?campaign=${campaign.id}`}
              className="text-xs whitespace-nowrap" style={{ color: ACCENT }}>
              Every email in Messages →
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Latest</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Next / last</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map(t => (
                <TableRow key={t.contactId} className="cursor-pointer" onClick={() => setOpenThread(t)}>
                  <TableCell>
                    <div className="text-sm">{t.email}</div>
                    {t.messages.length > 1 && (
                      <div className="outreach-mono text-[0.65rem] text-muted-foreground">
                        {t.messages.length} emails
                        {t.nextQueued ? ' · 1 queued' : ''}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                    {t.latest.subject}
                  </TableCell>
                  <TableCell><OutcomePill value={t.outcome} /></TableCell>
                  <TableCell className="o-num text-xs text-muted-foreground">
                    {/* What happens next beats what happened last: a queued
                        follow-up is the actionable fact about this conversation. */}
                    {t.nextQueued?.scheduled_at
                      ? `due ${formatTime(t.nextQueued.scheduled_at)}`
                      : t.latest.sent_at
                        ? formatTime(t.latest.sent_at)
                        : t.nextQueued ? 'waiting' : '—'}
                  </TableCell>
                  <TableCell className="max-w-[240px] text-xs text-muted-foreground">
                    {t.latest.skip_reason ?? t.latest.error ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {openThread && (
        <ThreadDialog
          thread={openThread}
          campaign={campaign}
          insight={insight}
          onClose={() => setOpenThread(null)}
        />
      )}
    </div>
  );
}
