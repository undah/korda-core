import { Badge } from '@/components/ui/badge';
import type { ContactSource, EmailStatus } from '../types';

/** Email status carries risk, so it carries colour. */
export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  const styles: Record<EmailStatus, string> = {
    verified:   'border-transparent bg-emerald-500/15 text-emerald-400',
    guessed:    'border-transparent bg-amber-500/15 text-amber-400',
    bounced:    'border-transparent bg-red-500/15 text-red-400',
    unverified: 'border-transparent bg-muted text-muted-foreground',
  };
  return <Badge className={`${styles[status]} font-normal`}>{status}</Badge>;
}

/** Source is provenance, not risk — keep it quiet. */
export function SourceBadge({ source }: { source: ContactSource }) {
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      {source}
    </Badge>
  );
}

/**
 * Confidence as a thin bar: scannable down a column in a way a decimal isn't.
 */
export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const tone =
    value >= 0.7 ? 'bg-emerald-400' : value >= 0.4 ? 'bg-amber-400' : 'bg-muted-foreground';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="outreach-mono text-[0.7rem] text-muted-foreground">{value.toFixed(2)}</span>
    </div>
  );
}

/** Consistent "nothing here yet" treatment: what happened, what to do next. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/60 py-14 text-center">
      <p className="text-sm text-foreground/80">{title}</p>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm text-destructive">Couldn't load this.</p>
      <p className="outreach-mono mt-1 text-xs text-muted-foreground">{message}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        If this says permission denied, apply the outreach RLS patch to Supabase.
      </p>
    </div>
  );
}
