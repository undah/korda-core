import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useAddSuppression, useRemoveSuppression, useSuppression,
} from '@/features/outreach/hooks/useOutreach';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function OutreachSuppression() {
  const { data: entries, isLoading, error } = useSuppression();
  const add = useAddSuppression();
  const remove = useRemoveSuppression();

  const [email, setEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [reason, setReason] = useState('');

  const handleAdd = async () => {
    if (!email.trim() && !domain.trim()) {
      toast.error('Enter an email or a domain to suppress.');
      return;
    }
    try {
      await add.mutateAsync({
        email: email.trim() || undefined,
        domain: domain.trim() || undefined,
        reason: reason.trim() || 'manual',
      });
      toast.success('Added to the suppression list.');
      setEmail(''); setDomain(''); setReason('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add that entry.');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success('Removed from the suppression list.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove that entry.');
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Compliance"
        title="Suppression"
        sub="Addresses and domains that must never be contacted. Unsubscribes and bounces land here automatically when the pipeline logs them — this list is also editable by hand."
      />

      <div className="o-panel mb-6 p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="sup-email">Email</Label>
            <Input id="sup-email" className="outreach-mono" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="info@example.nl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-domain">or Domain</Label>
            <Input id="sup-domain" className="outreach-mono" value={domain}
              onChange={e => setDomain(e.target.value)} placeholder="example.nl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-reason">Reason</Label>
            <Input id="sup-reason" value={reason}
              onChange={e => setReason(e.target.value)} placeholder="replied stop" />
          </div>
        </div>
        <Button className="mt-4" size="sm" disabled={add.isPending} onClick={() => void handleAdd()}>
          {add.isPending ? 'Adding…' : 'Add to suppression list'}
        </Button>
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <EmptyState title="Loading suppression list…" />
      ) : !entries || entries.length === 0 ? (
        <EmptyState
          title="Nothing suppressed yet."
          hint="That's fine — entries appear here when someone opts out or an address hard-bounces."
        />
      ) : (
        <div className="o-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="outreach-mono text-xs">{entry.email ?? '—'}</TableCell>
                  <TableCell className="outreach-mono text-xs">{entry.domain ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{entry.reason ?? '—'}</TableCell>
                  <TableCell className="outreach-mono text-xs text-muted-foreground">
                    {formatDateTime(entry.added_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" disabled={remove.isPending}
                      onClick={() => void handleRemove(entry.id)}>
                      Remove
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
