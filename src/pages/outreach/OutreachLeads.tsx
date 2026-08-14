import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useAddSuppression, useBulkSuppress, useBulkUpdateContacts, useLeads, useNiches,
} from '@/features/outreach/hooks/useOutreach';
import {
  ConfidenceBar, EmailStatusBadge, EmptyState, ErrorState, PageHeader, SourceBadge,
} from '@/features/outreach/components/indicators';
import { EditLeadDialog } from '@/features/outreach/components/EditLeadDialog';
import { DeleteLeadsDialog } from '@/features/outreach/components/DeleteLeadsDialog';
import { errorMessage } from '@/features/outreach/errors';
import {
  LEADS_PAGE_SIZE, type EmailStatus, type LeadsFilter, type OutreachReadyRow,
} from '@/features/outreach/types';

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
  const bulkSuppress = useBulkSuppress();
  const bulkUpdate = useBulkUpdateContacts();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<OutreachReadyRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      toast.error(errorMessage(e, 'Could not suppress that address.'));
    }
  };

  const page = filter.page ?? 1;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const rows = useMemo(() => data?.rows ?? [], [data]);

  // Selection is scoped to what is on screen. Anything filtered or paged away is
  // dropped, so a bulk delete can never touch a row the user cannot see.
  const visible = useMemo(() => new Set(rows.map(r => r.contact_id)), [rows]);
  const selectedIds = useMemo(
    () => [...selected].filter(id => visible.has(id)),
    [selected, visible],
  );
  const selectedRows = rows.filter(r => selected.has(r.contact_id));
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  const toggleRow = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map(r => r.contact_id)));

  const clearSelection = () => setSelected(new Set());

  const handleBulkSuppress = async () => {
    try {
      const added = await bulkSuppress.mutateAsync(selectedRows.map(r => r.email));
      const skipped = selectedRows.length - added;
      toast.success(
        `Suppressed ${added} address${added === 1 ? '' : 'es'}.`,
        skipped > 0 ? { description: `${skipped} already suppressed.` } : undefined,
      );
      clearSelection();
    } catch (e) {
      toast.error(errorMessage(e, 'Could not suppress those addresses.'));
    }
  };

  const handleBulkDnc = async () => {
    try {
      await bulkUpdate.mutateAsync({ ids: selectedIds, updates: { do_not_contact: true } });
      toast.success(`${selectedIds.length} lead${selectedIds.length === 1 ? '' : 's'} marked do-not-contact.`);
      clearSelection();
    } catch (e) {
      toast.error(errorMessage(e, 'Could not update those leads.'));
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline output"
        title="Leads"
        sub="Contacts ready to work — already filtered for suppression, bounces, and do-not-contact."
      />

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
          {selectedIds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.07] px-4 py-2.5">
              <span className="text-sm font-medium">
                {selectedIds.length} selected
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={bulkSuppress.isPending}
                  onClick={() => void handleBulkSuppress()}>
                  Suppress
                </Button>
                <Button variant="outline" size="sm" disabled={bulkUpdate.isPending}
                  onClick={() => void handleBulkDnc()}>
                  Do not contact
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
                  Delete
                </Button>
              </div>
            </div>
          )}

          <div className="o-panel">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-9">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll}
                      aria-label="Select all leads on this page" />
                  </TableHead>
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
                  <TableRow key={row.contact_id}
                    data-state={selected.has(row.contact_id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.has(row.contact_id)}
                        onCheckedChange={() => toggleRow(row.contact_id)}
                        aria-label={`Select ${row.business_name}`} />
                    </TableCell>
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
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                        Edit
                      </Button>
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

      <EditLeadDialog
        lead={editing}
        open={editing !== null}
        onOpenChange={open => { if (!open) setEditing(null); }}
      />

      <DeleteLeadsDialog
        ids={selectedIds}
        emails={selectedRows.map(r => r.email)}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={clearSelection}
      />
    </div>
  );
}
