import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useBulkDeleteContacts } from '../hooks/useOutreach';
import { errorMessage } from '../errors';

/**
 * Deleting leads, with the catch made explicit.
 *
 * A deleted contact is not a contact that stays gone. The pipeline re-crawls
 * the same businesses on a schedule, and the enricher that found the address
 * the first time will find it again — so deleting alone quietly reverses itself
 * on the next run. Suppression is the durable half, which is why it is offered
 * here and defaults to on.
 *
 * Left off deliberately when someone is clearing out junk they *want*
 * re-crawled — a mis-parsed address that a better crawl should replace.
 */
export function DeleteLeadsDialog({ ids, emails, open, onOpenChange, onDeleted }: {
  ids: string[];
  emails: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const remove = useBulkDeleteContacts();
  const [suppress, setSuppress] = useState(true);

  // Default back to the safe option each time it opens.
  useEffect(() => { if (open) setSuppress(true); }, [open]);

  const count = ids.length;

  const confirm = async () => {
    try {
      await remove.mutateAsync({ ids, emails, suppress });
      toast.success(
        `Deleted ${count} lead${count === 1 ? '' : 's'}.`,
        suppress
          ? { description: 'Their addresses are suppressed, so a re-run will not bring them back.' }
          : { description: 'Not suppressed — a future run may rediscover them.' },
      );
      onOpenChange(false);
      onDeleted?.();
    } catch (e) {
      toast.error(errorMessage(e, 'Could not delete those leads.'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {count} lead{count === 1 ? '' : 's'}?</DialogTitle>
          <DialogDescription>
            This removes the contact rows. The businesses themselves are kept.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <Checkbox id="also-suppress" checked={suppress}
            onCheckedChange={v => setSuppress(v === true)} className="mt-0.5" />
          <div>
            <Label htmlFor="also-suppress" className="cursor-pointer">
              Also suppress these addresses
            </Label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Deleting on its own is not permanent — the pipeline re-crawls these businesses and can
              find the same addresses again. Suppressing is what keeps them out for good. Leave it
              unchecked only if you want a future run to pick them up fresh.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => void confirm()}>
            {remove.isPending ? 'Deleting…' : `Delete ${count}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
