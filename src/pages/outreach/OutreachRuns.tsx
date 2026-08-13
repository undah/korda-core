import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNiches, useRuns } from '@/features/outreach/hooks/useOutreach';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function duration(started: string, finished: string | null): string {
  if (!finished) return 'running…';
  const ms = new Date(finished).getTime() - new Date(started).getTime();
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${Math.round(secs % 60)}s`;
}

export default function OutreachRuns() {
  const { data: runs, isLoading, error } = useRuns();
  const { data: niches } = useNiches();

  const nicheName = (id: string | null): string => {
    if (!id) return '—';
    return niches?.find(n => n.id === id)?.name ?? id.slice(0, 8);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Observability"
        title="Runs"
        sub="Every pipeline run, newest first — what it found and anything that broke."
      />

      {error ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <EmptyState title="Loading runs…" />
      ) : !runs || runs.length === 0 ? (
        <EmptyState
          title="No runs recorded yet."
          hint="Run a niche from the pipeline repo and it'll show up here."
        />
      ) : (
        <div className="o-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Niche</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Discovered</TableHead>
                <TableHead className="text-right">Enriched</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map(run => (
                <TableRow key={run.id}>
                  <TableCell className="text-sm">{nicheName(run.niche_id)}</TableCell>
                  <TableCell className="outreach-mono text-xs text-muted-foreground">
                    {formatDateTime(run.started_at)}
                  </TableCell>
                  <TableCell className="outreach-mono text-xs text-muted-foreground">
                    {duration(run.started_at, run.finished_at)}
                  </TableCell>
                  <TableCell className="outreach-mono text-right text-xs">{run.discovered ?? 0}</TableCell>
                  <TableCell className="outreach-mono text-right text-xs">{run.enriched ?? 0}</TableCell>
                  <TableCell className="outreach-mono text-right text-xs">{run.contacts_new ?? 0}</TableCell>
                  <TableCell className="max-w-[420px]">
                    {run.error ? (
                      // Errors are the whole point of this view — never truncate them.
                      <div className="outreach-mono whitespace-pre-wrap break-words text-[0.7rem] text-destructive">
                        {run.error}
                      </div>
                    ) : run.finished_at ? (
                      <Badge className="border-transparent bg-emerald-500/15 font-normal text-emerald-400">
                        ok
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        in progress
                      </Badge>
                    )}
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
