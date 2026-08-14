import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useCampaign, useCampaignControl, useCampaignMessages } from '@/features/outreach/hooks/useEmail';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';
import { errorMessage } from '@/features/outreach/errors';
import type { MessageStatus } from '@/features/outreach/types';

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

export default function OutreachCampaign() {
  const { id } = useParams<{ id: string }>();
  const { data: campaign, isLoading, error } = useCampaign(id);
  const { data: messages } = useCampaignMessages(id);
  const control = useCampaignControl();

  const rows = messages ?? [];
  const queued = rows.filter(m => m.status === 'queued').length;
  const sent = rows.filter(m => m.status === 'sent').length;
  const replied = rows.filter(m => m.skip_reason === 'replied').length;
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
                <TableHead>Status</TableHead>
                <TableHead>Due / sent</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm">{m.to_email}</TableCell>
                  {steps.length > 1 && (
                    <TableCell className="o-num text-xs text-muted-foreground">{m.step_number}</TableCell>
                  )}
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">{m.subject}</TableCell>
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
    </div>
  );
}
