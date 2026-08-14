import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useAddSuppression, useBusiness, useBusinessContacts, useDeleteContact, useUpdateContact,
} from '@/features/outreach/hooks/useOutreach';
import {
  ConfidenceBar, EmailStatusBadge, EmptyState, ErrorState, PageHeader, SourceBadge,
} from '@/features/outreach/components/indicators';
import { errorMessage } from '@/features/outreach/errors';
import type { Contact } from '@/features/outreach/types';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm text-foreground">{children}</div>
    </div>
  );
}

export default function OutreachBusiness() {
  const { id } = useParams<{ id: string }>();
  const { data: business, isLoading, error } = useBusiness(id);
  const { data: contacts } = useBusinessContacts(id);
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const suppress = useAddSuppression();

  const toggleDnc = async (contact: Contact) => {
    try {
      await updateContact.mutateAsync({ id: contact.id, do_not_contact: !contact.do_not_contact });
    } catch (e) {
      toast.error(errorMessage(e, 'Could not update that contact.'));
    }
  };

  const removeContact = async (contactId: string) => {
    try {
      await deleteContact.mutateAsync(contactId);
      toast.success('Contact deleted.');
    } catch (e) {
      toast.error(errorMessage(e, 'Could not delete that contact.'));
    }
  };

  const suppressDomain = async () => {
    if (!business?.domain) return;
    try {
      await suppress.mutateAsync({ domain: business.domain, reason: 'manual — domain' });
      toast.success(`Suppressed everything at ${business.domain}`);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not suppress that domain.'));
    }
  };

  if (error) return <ErrorState error={error} />;
  if (isLoading) return <EmptyState title="Loading business…" />;
  if (!business) return <EmptyState title="That business doesn't exist." />;

  return (
    <div>
      <Link to="/outreach/leads" className="o-mono text-xs text-muted-foreground hover:text-foreground">
        ← back to leads
      </Link>

      <div className="mt-3">
        <PageHeader
          eyebrow="Business"
          title={business.name}
          sub={business.formatted_address ?? 'No address on record'}
          actions={business.domain ? (
            <Button variant="outline" size="sm" disabled={suppress.isPending}
              onClick={() => void suppressDomain()}>
              Suppress domain
            </Button>
          ) : undefined}
        />
      </div>

      <div className="o-panel mb-6 grid gap-5 p-4 sm:grid-cols-3">
        <Fact label="Phone">
          <span className="outreach-mono text-xs">{business.phone ?? '—'}</span>
        </Fact>
        <Fact label="Website">
          {business.website ? (
            <a href={business.website} target="_blank" rel="noreferrer noopener"
              className="outreach-mono text-xs text-primary hover:underline">
              {business.domain ?? business.website}
            </a>
          ) : '—'}
        </Fact>
        <Fact label="Rating">
          <span className="outreach-mono text-xs">
            {business.rating ?? '—'}
            {business.ratings_total !== null && (
              <span className="text-muted-foreground"> ({business.ratings_total})</span>
            )}
          </span>
        </Fact>
        <Fact label="Discovered">
          <span className="outreach-mono text-xs">{formatDateTime(business.discovered_at)}</span>
        </Fact>
        <Fact label="Last enriched">
          <span className="outreach-mono text-xs">{formatDateTime(business.last_enriched_at)}</span>
        </Fact>
        <Fact label="Type">
          <span className="outreach-mono text-xs">{business.primary_type ?? '—'}</span>
        </Fact>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-foreground">Contacts</h2>

      {!contacts || contacts.length === 0 ? (
        <EmptyState
          title="No contacts found for this business."
          hint="Enrichment found no email or owner name on the site."
        />
      ) : (
        <div className="o-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Provenance</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-center">Do not contact</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map(contact => (
                <TableRow key={contact.id}>
                  <TableCell>
                    {contact.full_name ?? <span className="text-muted-foreground">—</span>}
                    {contact.role && (
                      <div className="text-[0.7rem] capitalize text-muted-foreground">{contact.role}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="outreach-mono text-xs">{contact.email ?? '—'}</div>
                    <div className="mt-1"><EmailStatusBadge status={contact.email_status} /></div>
                  </TableCell>
                  <TableCell>
                    <SourceBadge source={contact.source} />
                    {contact.source_url && (
                      <div className="mt-1">
                        <a href={contact.source_url} target="_blank" rel="noreferrer noopener"
                          className="outreach-mono text-[0.68rem] text-muted-foreground hover:text-primary">
                          where this came from ↗
                        </a>
                      </div>
                    )}
                  </TableCell>
                  <TableCell><ConfidenceBar value={contact.confidence} /></TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={contact.do_not_contact}
                      disabled={updateContact.isPending}
                      onCheckedChange={() => void toggleDnc(contact)}
                      aria-label={`Do not contact ${contact.email ?? contact.full_name ?? 'contact'}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-destructive"
                      disabled={deleteContact.isPending}
                      onClick={() => void removeContact(contact.id)}>
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
