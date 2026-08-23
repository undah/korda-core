import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  capToday, useDeleteIdentity, useIdentities, useIdentityUsage, useSaveIdentity,
} from '@/features/outreach/hooks/useIdentities';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';
import { errorMessage } from '@/features/outreach/errors';
import type { SendingIdentity, SendingIdentityDraft } from '@/features/outreach/types';

/**
 * The complete set of adapters the sender knows how to call — see sendMail in
 * korda-outreach/src/send.ts. This was a free-text field, which meant a typo
 * ("smpt") saved happily and only surfaced at send time, as a failed message
 * that had already consumed a queue slot. A new vendor doesn't need a new entry
 * here: that's what "http" is for, configured entirely by env.
 */
const PROVIDERS: { value: string; label: string }[] = [
  { value: 'smtp', label: 'smtp — a real mailbox (Google Workspace, Microsoft 365)' },
  { value: 'resend', label: 'resend — Resend API' },
  { value: 'smartlead', label: 'smartlead — Smartlead API' },
  { value: 'http', label: 'http — generic JSON endpoint, configured by env' },
];

const EMPTY: SendingIdentityDraft = {
  label: '', from_email: '', from_name: null, reply_to: null,
  provider: 'resend', credential_key: 'RESEND_API_KEY',
  daily_cap: 40, warmup_started_on: null, active: true,
  smtp_host: null, smtp_port: null, smtp_secure: null,
};

export default function OutreachSenders() {
  const { data: identities, isLoading, error } = useIdentities();
  const { data: usage } = useIdentityUsage();
  const save = useSaveIdentity();
  const remove = useDeleteIdentity();

  const [editing, setEditing] = useState<(SendingIdentityDraft & { id?: string }) | null>(null);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.label.trim()) return toast.error('Give the mailbox a label.');
    if (!editing.from_email.includes('@')) return toast.error('That is not an email address.');
    try {
      await save.mutateAsync(editing);
      toast.success('Sender saved.');
      setEditing(null);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save that sender.'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success('Sender removed.');
    } catch (e) {
      toast.error(errorMessage(e, 'Could not remove that sender.'));
    }
  };

  const rows = identities ?? [];
  const totalToday = rows.filter(i => i.active).reduce((sum, i) => sum + capToday(i), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Deliverability"
        title="Senders"
        sub="The mailboxes campaigns send from. Daily capacity is per mailbox, not per campaign."
        actions={
          <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>Add sender</Button>
        }
      />

      <div className="o-panel mb-4 p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          A single domain safely carries roughly <strong>100–150 emails a day</strong> — the accepted
          band is 30–50 per mailbox with 2–3 mailboxes per domain, because volume concentrated on one
          domain concentrates the reputation risk with it. Higher volume means more mailboxes across
          more <em>secondary</em> domains, never your primary one. Set a warm-up date on every new
          mailbox: it ramps from 5/day and takes two to three weeks to reach its cap.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Credentials are not stored here. <span className="outreach-mono">Credential key</span> names
          an environment variable on whichever host actually sends — Cloudflare Pages for Resend,
          Smartlead and generic HTTP providers, or the pipeline (Railway) for an <span className="outreach-mono">smtp</span> mailbox — so nothing secret is ever exposed to this page.
        </p>
        {rows.length > 0 && (
          <p className="mt-3 text-sm">
            Pool capacity today: <span className="o-num font-medium">{totalToday}</span> emails
          </p>
        )}
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <EmptyState title="Loading senders…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No senders configured."
          hint="Campaigns fall back to the single OUTREACH_FROM address until you add one."
        />
      ) : (
        <div className="o-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mailbox</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Credential key</TableHead>
                <TableHead className="text-right">Today</TableHead>
                <TableHead className="text-right">Cap</TableHead>
                <TableHead>Warm-up</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(identity => {
                const cap = capToday(identity);
                const used = usage?.[identity.id] ?? 0;
                return (
                  <TableRow key={identity.id}>
                    <TableCell>
                      <div className="text-sm">{identity.label}</div>
                      <div className="outreach-mono text-[0.7rem] text-muted-foreground">
                        {identity.from_email}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{identity.provider}</TableCell>
                    <TableCell className="outreach-mono text-[0.7rem] text-muted-foreground">
                      {identity.credential_key}
                    </TableCell>
                    <TableCell className="o-num text-right text-xs">
                      <span className={used >= cap ? 'text-amber-400' : ''}>{used}</span>
                    </TableCell>
                    <TableCell className="o-num text-right text-xs text-muted-foreground">
                      {cap}
                      {cap < identity.daily_cap && (
                        <span className="ml-1 text-[0.65rem] text-amber-400">ramping</span>
                      )}
                    </TableCell>
                    <TableCell className="outreach-mono text-[0.7rem] text-muted-foreground">
                      {identity.warmup_started_on ?? '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={identity.active} disabled={save.isPending}
                        onCheckedChange={v => void save.mutateAsync({
                          ...(identity as SendingIdentity), active: v,
                        })} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setEditing({ ...identity })}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive"
                        disabled={remove.isPending} onClick={() => void handleDelete(identity.id)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={open => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit sender' : 'Add sender'}</DialogTitle>
            <DialogDescription>
              One mailbox in the pool. Use a secondary domain, never your primary.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="s-label">Label</Label>
                  <Input id="s-label" value={editing.label} placeholder="outreach-1"
                    onChange={e => setEditing({ ...editing, label: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-from">From address</Label>
                  <Input id="s-from" className="outreach-mono" value={editing.from_email}
                    placeholder="gijs@mail-a.kordacore.com"
                    onChange={e => setEditing({ ...editing, from_email: e.target.value })} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="s-name">From name</Label>
                  <Input id="s-name" value={editing.from_name ?? ''} placeholder="Gijs"
                    onChange={e => setEditing({ ...editing, from_name: e.target.value || null })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-reply">Reply-to</Label>
                  <Input id="s-reply" className="outreach-mono" value={editing.reply_to ?? ''}
                    placeholder="reply@mail.kordacore.com"
                    onChange={e => setEditing({ ...editing, reply_to: e.target.value || null })} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="s-provider">Provider</Label>
                  <Select value={editing.provider}
                    onValueChange={v => setEditing({ ...editing, provider: v })}>
                    <SelectTrigger id="s-provider" className="outreach-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map(p => (
                        <SelectItem key={p.value} value={p.value} className="text-xs">
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-cred">Credential key</Label>
                  <Input id="s-cred" className="outreach-mono" value={editing.credential_key}
                    placeholder="RESEND_API_KEY"
                    onChange={e => setEditing({ ...editing, credential_key: e.target.value })} />
                </div>
              </div>

              {editing.provider === 'smtp' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-smtp-host">SMTP host</Label>
                    <Input id="s-smtp-host" className="outreach-mono" value={editing.smtp_host ?? ''}
                      placeholder="smtp.gmail.com"
                      onChange={e => setEditing({ ...editing, smtp_host: e.target.value || null })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-smtp-port">SMTP port</Label>
                    <Input id="s-smtp-port" className="outreach-mono"
                      value={editing.smtp_port ?? ''} placeholder="587"
                      onChange={e => setEditing({
                        ...editing, smtp_port: e.target.value ? Number(e.target.value) || null : null,
                      })} />
                    <p className="text-xs text-muted-foreground">
                      From address is the SMTP username; credential key holds the app password.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="s-cap">Daily cap</Label>
                  <Input id="s-cap" className="outreach-mono" value={editing.daily_cap}
                    onChange={e => setEditing({
                      ...editing, daily_cap: Math.max(0, Number(e.target.value) || 0),
                    })} />
                  <p className="text-xs text-muted-foreground">30–50 is the safe band.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-warm">Warm-up started</Label>
                  <Input id="s-warm" type="date" className="outreach-mono"
                    value={editing.warmup_started_on ?? ''}
                    onChange={e => setEditing({
                      ...editing, warmup_started_on: e.target.value || null,
                    })} />
                  <p className="text-xs text-muted-foreground">Blank = no ramp.</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={save.isPending} onClick={() => void handleSave()}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
