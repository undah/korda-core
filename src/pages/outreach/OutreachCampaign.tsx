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
  useCampaign, useCampaignControl, useCampaignMessages, useUpdateMessage,
} from '@/features/outreach/hooks/useEmail';
import { useGeneratePersonalization } from '@/features/outreach/hooks/usePersonalize';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';
import { errorMessage } from '@/features/outreach/errors';
import type { Campaign, MessageStatus, OutreachMessage } from '@/features/outreach/types';

const PILL: Record<MessageStatus, string> = {
  queued: 'o-pill-unverified',
  sending: 'o-pill-guessed',
  sent: 'o-pill-verified',
  failed: 'o-pill-bounced',
  skipped: 'o-pill-neutral',
  canceled: 'o-pill-neutral',
};

function formatTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Read and, while still queued, edit or regenerate one message. This is the
 * "read every one before it sends" half of upfront generation — Generate never
 * sends anything by itself, so a bad email here costs a re-click, not a send.
 */
function MessageDialog({ message, campaign, open, onOpenChange }: {
  message: OutreachMessage | null;
  campaign: Campaign;
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

  const handleRegenerate = async () => {
    if (!message) return;
    try {
      const outcome = await generate.mutateAsync({
        contactId: message.contact_id,
        objective: message.objective ?? campaign.objective,
      });
      if (outcome.ok) {
        setSubject(outcome.subject);
        setBody(outcome.body);
        toast.success('Regenerated — save to keep it.');
      } else {
        toast.error(`Claude didn't produce an email: ${outcome.reason}`);
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
          <DialogDescription>
            {message?.to_email}
            {!editable && message && ` · ${message.status}`}
          </DialogDescription>
        </DialogHeader>

        {message && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-subject">Subject</Label>
              <Input id="m-subject" value={subject} disabled={!editable}
                onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-body">Body</Label>
              <Textarea id="m-body" rows={10} className="font-mono text-sm" disabled={!editable}
                value={body} onChange={e => setBody(e.target.value)} />
            </div>
            {message.personalization_error && (
              <p className="text-xs text-destructive">
                Generation didn't produce an email for this lead ({message.personalization_error}) —
                showing the rendered template instead.
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
  const control = useCampaignControl();
  const [openMessage, setOpenMessage] = useState<OutreachMessage | null>(null);

  const rows = messages ?? [];
  const queued = rows.filter(m => m.status === 'queued').length;
  const sent = rows.filter(m => m.status === 'sent').length;
  const replied = rows.filter(m => m.skip_reason === 'replied').length;
  const personalized = rows.filter(m => m.personalized).length;
  const steps = [...new Set(rows.map(m => m.step_number))].sort((a, b) => a - b);
  const running = campaign?.status === 'sending';

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
            `${sent} sent · ${queued} queued · ${replied} replied` +
            (steps.length > 1 ? ` · ${steps.length} steps` : '') +
            (campaign.personalize === 'full' ? ` · ${personalized}/${rows.length} personalized` : '') +
            ` · status: ${campaign.status}`
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

      {!messages || messages.length === 0 ? (
        <EmptyState title="No messages in this campaign." />
      ) : (
        <div className="o-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                {steps.length > 1 && <TableHead className="w-14">Step</TableHead>}
                <TableHead>Subject</TableHead>
                {campaign.personalize === 'full' && <TableHead className="w-10" />}
                <TableHead>Status</TableHead>
                <TableHead>Due / sent</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map(m => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => setOpenMessage(m)}>
                  <TableCell className="text-sm">{m.to_email}</TableCell>
                  {steps.length > 1 && (
                    <TableCell className="o-num text-xs text-muted-foreground">{m.step_number}</TableCell>
                  )}
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">{m.subject}</TableCell>
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
                  <TableCell><span className={`o-pill ${PILL[m.status]}`}>{m.status}</span></TableCell>
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
        open={openMessage !== null}
        onOpenChange={open => { if (!open) setOpenMessage(null); }}
      />
    </div>
  );
}
