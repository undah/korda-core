import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useCampaign, useCampaignMessages, useSendCampaign } from '@/features/outreach/hooks/useEmail';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';
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
  const send = useSendCampaign();

  const queued = (messages ?? []).filter(m => m.status === 'queued').length;

  const handleSend = async () => {
    if (!id) return;
    try {
      const r = await send.mutateAsync(id);
      toast.success(`${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed.');
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
          sub={`${messages?.length ?? 0} recipient${(messages?.length ?? 0) === 1 ? '' : 's'} · status: ${campaign.status}`}
          actions={queued > 0 ? (
            <Button disabled={send.isPending} onClick={() => void handleSend()}>
              {send.isPending ? 'Sending…' : `Send ${queued} queued`}
            </Button>
          ) : undefined}
        />
      </div>

      {!messages || messages.length === 0 ? (
        <EmptyState title="No messages in this campaign." />
      ) : (
        <div className="o-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm">{m.to_email}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">{m.subject}</TableCell>
                  <TableCell><span className={`o-pill ${PILL[m.status]}`}>{m.status}</span></TableCell>
                  <TableCell className="o-num text-xs text-muted-foreground">{formatTime(m.sent_at)}</TableCell>
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
