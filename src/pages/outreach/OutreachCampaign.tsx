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

function formatTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * The outcome that stands for a message: what the sender did, overridden by
 * what the recipient did. A row saying `sent` whose contact then replied is a
 * reply, and that is the only reading anyone cares about.
 */
function outcomeOf(m: OutreachMessage, insight: CampaignInsight | undefined): string {
  const evt = m.status === 'sent' ? insight?.outcomes.get(m.contact_id) : undefined;
  return evt?.type ?? m.status;
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
 * Read and, while still queued, edit or regenerate one message. This is the
 * "read every one before it sends" half of upfront generation — Generate never
 * sends anything by itself, so a bad email here costs a re-click, not a send.
 *
 * A sent message is deliberately thin here: its full history lives on the
 * Messages page, and duplicating that was the previous version's whole problem.
 */
function MessageDialog({ message, campaign, insight, open, onOpenChange }: {
  message: OutreachMessage | null;
  campaign: Campaign;
  insight: CampaignInsight | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateMessage();
  const generate = useGeneratePersonalization();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (message) { setSubject(message.subject); setBody(message.body); }
  }, [message]);

  const editable = message?.status === 'queued';
  const outcome = message ? outcomeOf(message, insight) : null;
  const evt = message ? insight?.outcomes.get(message.contact_id) : undefined;

  const handleRegenerate = async () => {
    if (!message) return;
    try {
      const result = await generate.mutateAsync({
        contactId: message.contact_id,
        objective: message.objective ?? campaign.objective,
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
    if (!message) return;
    try {
      await update.mutateAsync({
        id: message.id, campaignId: message.campaign_id, subject, body,
        // Editing by hand after an AI draft is still your personalized email;
        // editing a plain template does not retroactively make it one.
        personalized: message.personalized || undefined,
      });
      toast.success('Saved.');
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save that message.'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editable ? 'Edit message' : 'Message'}</DialogTitle>
          <DialogDescription>{message?.to_email}</DialogDescription>
        </DialogHeader>

        {message && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {outcome && <OutcomePill value={outcome} />}
              {evt && (
                <span className="text-[0.7rem] text-muted-foreground">
                  {evt.type} {formatTime(evt.at)}
                </span>
              )}
            </div>

            {editable ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="m-subject">Subject</Label>
                  <Input id="m-subject" value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-body">Body</Label>
                  <Textarea id="m-body" rows={10} className="font-mono text-sm"
                    value={body} onChange={e => setBody(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
                  {[
                    ['Sent', formatTime(message.sent_at)],
                    ['Step', String(message.step_number ?? 1)],
                    ['Written by', message.personalized ? 'Claude' : 'template'],
                    ['Subject', message.subject],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b pb-1">
                      <span className="outreach-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground">
                        {k}
                      </span>
                      <span className="truncate text-right">{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[0.7rem] text-muted-foreground">
                  The body as sent, and everything recorded for this contact, are on the
                  Messages page.
                </p>
                <Link to="/outreach/messages" className="text-xs" style={{ color: '#1b31c4' }}>
                  Open Messages →
                </Link>
              </>
            )}

            {(message.error || message.skip_reason) && (
              <p className="text-xs" style={{ color: INK.bad }}>
                {message.error ?? message.skip_reason}
              </p>
            )}
            {message.personalization_error && (
              <p className="text-xs text-muted-foreground">
                Generation didn't produce an email for this lead ({message.personalization_error}) —
                the rendered template was used instead.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {editable ? (
            <Button variant="outline" size="sm" disabled={generate.isPending}
              onClick={() => void handleRegenerate()}>
              {generate.isPending ? 'Generating…' : 'Regenerate with Claude'}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            {editable && (
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
  const [openMessage, setOpenMessage] = useState<OutreachMessage | null>(null);

  const rows = messages ?? [];
  const queued = rows.filter(m => m.status === 'queued').length;
  const sent = rows.filter(m => m.status === 'sent').length;
  const failed = rows.filter(m => m.status === 'failed').length;
  const personalized = rows.filter(m => m.personalized).length;
  const steps = [...new Set(rows.map(m => m.step_number))].sort((a, b) => a - b);
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

      {breakdown.length > 1 && (
        <div className="o-panel mb-4 p-4">
          <div className="mb-1 text-sm">{insight?.hasSequence ? 'By step' : 'By message number'}</div>
          <p className="mb-3 text-xs text-muted-foreground">
            {insight?.hasSequence
              ? 'A reply is credited to the last step that reached the contact before they answered.'
              : 'Not sequence steps — this campaign holds one-off sends, so the number is simply the nth email to that contact.'}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{insight?.hasSequence ? 'Step' : '#'}</TableHead>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                {steps.length > 1 && (
                  <TableHead className="w-14">{insight?.hasSequence ? 'Step' : '#'}</TableHead>
                )}
                <TableHead>Subject</TableHead>
                {campaign.personalize === 'full' && <TableHead className="w-10" />}
                <TableHead>Outcome</TableHead>
                <TableHead>Due / sent</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(m => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => setOpenMessage(m)}>
                  <TableCell className="text-sm">{m.to_email}</TableCell>
                  {steps.length > 1 && (
                    <TableCell className="o-num text-xs text-muted-foreground">{m.step_number}</TableCell>
                  )}
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                    {m.subject}
                  </TableCell>
                  {campaign.personalize === 'full' && (
                    <TableCell>
                      <span
                        className={`o-pill ${m.personalized ? 'o-pill-verified' : 'o-pill-neutral'}`}
                        title={m.personalization_error ?? undefined}
                      >
                        {m.personalized ? 'AI' : 'template'}
                      </span>
                    </TableCell>
                  )}
                  <TableCell><OutcomePill value={outcomeOf(m, insight)} /></TableCell>
                  <TableCell className="o-num text-xs text-muted-foreground">
                    {/* Once sent that time is the fact; before then, when it comes
                        due is what the user actually wants to know. */}
                    {m.sent_at
                      ? formatTime(m.sent_at)
                      : m.scheduled_at
                        ? `due ${formatTime(m.scheduled_at)}`
                        : m.status === 'queued' ? 'waiting' : '—'}
                  </TableCell>
                  <TableCell className="max-w-[260px] text-xs text-muted-foreground">
                    {/* Skip reasons and provider errors are the whole point of this
                        view when something didn't land — show them in full. */}
                    {m.skip_reason ?? m.error ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MessageDialog
        message={openMessage}
        campaign={campaign}
        insight={insight}
        open={openMessage !== null}
        onOpenChange={open => { if (!open) setOpenMessage(null); }}
      />
    </div>
  );
}
