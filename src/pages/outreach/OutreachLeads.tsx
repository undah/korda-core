import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useAddSuppression, useLeads, useNiches,
} from '@/features/outreach/hooks/useOutreach';
import {
  ConfidenceBar, EmailStatusBadge, EmptyState, ErrorState, SourceBadge,
} from '@/features/outreach/components/indicators';
import { LEADS_PAGE_SIZE, type EmailStatus, type LeadsFilter } from '@/features/outreach/types';

const ANY = '__any__';
const EMAIL_STATUSES: EmailStatus[] = ['verified', 'guessed', 'unverified', 'bounced'];
const CONFIDENCE_STEPS = ['0.4', '0.6', '0.8'];

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function OutreachLeads() {
  const [params, setParams] = useSearchParams();
  const { data: niches } = useNiches();
  const suppress = useAddSuppression();

  // Filters live in the URL so a filtered view is shareable and survives reload.
  const filter: LeadsFilter = {
    niche: params.get('niche') ?? undefined,
    emailStatus: (params.get('status') as EmailStatus | null) ?? undefined,
    minConfidence: params.get('minConfidence') ? Number(params.get('minConfidence')) : undefined,
    search: params.get('q') ?? undefined,
    page: params.get('page') ? Number(params.get('page')) : 1,
  };

  const { data, isLoading, error } = useLeads(filter);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === '' || value === ANY) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page'); // any filter change resets paging
    setParams(next, { replace: true });
  };

  const handleSuppress = async (email: string) => {
    try {
      await suppress.mutateAsync({ email, reason: 'manual' });
      toast.success(`Suppressed ${email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not suppress that address.');
    }
  };

  const page = filter.page ?? 1;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const rows = data?.rows ?? [];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="outreach-page-title">Leads</h1>
        <p className="outreach-page-sub">
          Contacts ready to work — already filtered for suppression, bounces, and do-not-contact.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search business, name, or email"
          className="h-9 w-[260px]"
          defaultValue={filter.search ?? ''}
          onKeyDown={e => {
            if (e.key === 'Enter') setParam('q', (e.target as HTMLInputElement).value.trim());
          }}
          onBlur={e => setParam('q', e.target.value.trim())}
        />

        <Select value={filter.niche ?? ANY} onValueChange={v => setParam('niche', v)}>
          <SelectTrigger className="h-9 w-[190px]"><SelectValue placeholder="All niches" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All niches</SelectItem>
            {(niches ?? []).map(n => (
              <SelectItem key={n.id} value={n.slug}>{n.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filter.emailStatus ?? ANY} onValueChange={v => setParam('status', v)}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Any status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any status</SelectItem>
            {EMAIL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={filter.minConfidence ? String(filter.minConfidence) : ANY}
          onValueChange={v => setParam('minConfidence', v)}
        >
          <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Any confidence" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any confidence</SelectItem>
            {CONFIDENCE_STEPS.map(c => <SelectItem key={c} value={c}>≥ {c}</SelectItem>)}
          </SelectContent>
        </Select>

        {[...params.keys()].length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            Clear filters
          </Button>
        )}

        <span className="outreach-mono ml-auto text-xs text-muted-foreground">
          {isLoading ? 'loading…' : `${total} lead${total === 1 ? '' : 's'}`}
        </span>
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <EmptyState title="Loading leads…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No leads yet."
          hint="Run a niche from the pipeline, or loosen the filters above."
        />
      ) : (
        <>
          <div className="rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Niche</TableHead>
                  <TableHead>Last contacted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.contact_id}>
                    <TableCell>
                      <Link
                        to={`/outreach/businesses/${row.business_id}`}
                        className="text-foreground hover:text-primary"
                      >
                        {row.business_name}
                      </Link>
                      {row.domain && (
                        <div className="outreach-mono text-[0.7rem] text-muted-foreground">{row.domain}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.full_name ?? <span className="text-muted-foreground">—</span>}
                      {row.role && (
                        <div className="text-[0.7rem] capitalize text-muted-foreground">{row.role}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="outreach-mono text-xs">{row.email}</div>
                      <div className="mt-1"><EmailStatusBadge status={row.email_status} /></div>
                    </TableCell>
                    <TableCell><SourceBadge source={row.source} /></TableCell>
                    <TableCell><ConfidenceBar value={row.confidence} /></TableCell>
                    <TableCell className="outreach-mono text-xs text-muted-foreground">
                      {row.niche ?? '—'}
                    </TableCell>
                    <TableCell className="outreach-mono text-xs text-muted-foreground">
                      {formatDate(row.last_contacted_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={suppress.isPending}
                        onClick={() => void handleSuppress(row.email)}
                      >
                        Suppress
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="outreach-mono text-xs text-muted-foreground">
                page {page} / {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm" disabled={page <= 1}
                  onClick={() => setParam('page', String(page - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline" size="sm" disabled={page >= totalPages}
                  onClick={() => setParam('page', String(page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
