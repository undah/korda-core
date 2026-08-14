import { useEffect, useState } from 'react';
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
import { useUpdateContact } from '../hooks/useOutreach';
import { errorMessage } from '../errors';
import type { EmailStatus, OutreachReadyRow } from '../types';

const STATUSES: EmailStatus[] = ['verified', 'guessed', 'unverified', 'bounced'];

/**
 * Correcting one lead by hand.
 *
 * Enrichment guesses: it picks a name off a page that may belong to someone
 * else, and scores an address it has never delivered to. This is where a human
 * who knows better fixes it — most often putting a real name against a generic
 * mailbox, or marking an address verified before a send.
 */
export function EditLeadDialog({ lead, open, onOpenChange }: {
  lead: OutreachReadyRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateContact();
  const [draft, setDraft] = useState({
    full_name: '', role: '', email: '',
    email_status: 'unverified' as EmailStatus,
    do_not_contact: false,
  });

  // Reset whenever a different lead is opened, so the form never shows the
  // previous row's values for a moment.
  useEffect(() => {
    if (!lead) return;
    setDraft({
      full_name: lead.full_name ?? '',
      role: lead.role ?? '',
      email: lead.email,
      email_status: lead.email_status,
      do_not_contact: false,
    });
  }, [lead]);

  const save = async () => {
    if (!lead) return;
    const email = draft.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('That does not look like an email address.');
      return;
    }
    try {
      await update.mutateAsync({
        id: lead.contact_id,
        full_name: draft.full_name.trim() || null,
        role: draft.role.trim() || null,
        email,
        email_status: draft.email_status,
        do_not_contact: draft.do_not_contact,
      });
      toast.success('Lead updated.');
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not update that lead.'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit lead</DialogTitle>
          <DialogDescription>
            {lead?.business_name}
            {lead?.domain ? ` · ${lead.domain}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="l-name">Contact name</Label>
              <Input id="l-name" value={draft.full_name} placeholder="Jan Jansen"
                onChange={e => setDraft(d => ({ ...d, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="l-role">Role</Label>
              <Input id="l-role" value={draft.role} placeholder="Eigenaar"
                onChange={e => setDraft(d => ({ ...d, role: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="l-email">Email</Label>
            <Input id="l-email" className="outreach-mono" value={draft.email}
              onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Email status</Label>
            <Select value={draft.email_status}
              onValueChange={v => setDraft(d => ({ ...d, email_status: v as EmailStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Marking an address <span className="outreach-mono">bounced</span> suppresses it
              automatically.
            </p>
          </div>

          <div className="flex items-center gap-3 border-t border-white/8 pt-4">
            <Switch id="l-dnc" checked={draft.do_not_contact}
              onCheckedChange={v => setDraft(d => ({ ...d, do_not_contact: v }))} />
            <div>
              <Label htmlFor="l-dnc">Do not contact</Label>
              <p className="text-xs text-muted-foreground">
                Keeps the lead but excludes it from every campaign.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={update.isPending} onClick={() => void save()}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
