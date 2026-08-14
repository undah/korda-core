import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useCampaignControl, useCampaigns, useDeleteCampaign } from '@/features/outreach/hooks/useEmail';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';
import { errorMessage } from '@/features/outreach/errors';
import type { CampaignStatus } from '@/features/outreach/types';

function StatusPill({ status }: { status: CampaignStatus }) {
  const cls: Record<CampaignStatus, string> = {
    draft: 'o-pill-unverified',
    sending: 'o-pill-guessed',
    sent: 'o-pill-verified',
    paused: 'o-pill-neutral',
  };
  return <span className={`o-pill ${cls[status]}`}>{status}</span>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OutreachCampaigns() {
  const { data: campaigns, isLoading, error } = useCampaigns();
  const control = useCampaignControl();
  const remove = useDeleteCampaign();

  const handleControl = async (id: string, name: string, action: 'start' | 'pause') => {
    try {
      await control.mutateAsync({ campaignId: id, action });
      toast.success(action === 'start' ? `${name} started — sending is paced.` : `${name} paused.`);
    } catch (e) {
      toast.error(errorMessage(e, `Could not ${action} that campaign.`));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success('Campaign deleted.');
    } catch (e) {
      toast.error(errorMessage(e, 'Could not delete that campaign.'));
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Outreach"
        title="Campaigns"
        sub="One-shot sends to leads you've gathered. Every email carries an unsubscribe link, and suppression is re-checked at send time."
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link to="/outreach/templates">Templates</Link></Button>
            <Button asChild size="sm"><Link to="/outreach/campaigns/new">New campaign</Link></Button>
          </>
        }
      />

      {error ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <EmptyState title="Loading campaigns…" />
      ) : !campaigns || campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet."
          hint="Create one to pick a template, choose recipients from your leads, and send."
        />
      ) : (
        <div className="o-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Queued</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to={`/outreach/campaigns/${c.id}`} className="text-foreground hover:text-primary">
                      {c.name}
                    </Link>
                    <div className="text-[0.72rem] text-muted-foreground">{c.total} recipient{c.total === 1 ? '' : 's'}</div>
                  </TableCell>
                  <TableCell><StatusPill status={c.status} /></TableCell>
                  <TableCell className="o-num text-right">{c.queued}</TableCell>
                  <TableCell className="o-num text-right text-emerald-400">{c.sent}</TableCell>
                  <TableCell className="o-num text-right text-muted-foreground">{c.skipped}</TableCell>
                  <TableCell className={`o-num text-right ${c.failed ? 'text-red-400' : 'text-muted-foreground'}`}>{c.failed}</TableCell>
                  <TableCell className="o-num text-xs text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                  <TableCell className="text-right">
                    {c.status === 'sending' ? (
                      <Button variant="outline" size="sm" disabled={control.isPending}
                        onClick={() => void handleControl(c.id, c.name, 'pause')}>
                        Pause
                      </Button>
                    ) : c.queued > 0 ? (
                      <Button size="sm" disabled={control.isPending}
                        onClick={() => void handleControl(c.id, c.name, 'start')}>
                        {c.status === 'paused' ? 'Resume' : 'Start'}
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="sm" className="text-destructive"
                      disabled={remove.isPending} onClick={() => void handleDelete(c.id)}>
                      Delete
                    </Button>
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
