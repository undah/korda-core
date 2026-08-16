import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useAddSuppression, useBusiness, useBusinessContacts, useDeleteContact, useUpdateContact,
} from '@/features/outreach/hooks/useOutreach';
import { renderTemplate, useTemplates } from '@/features/outreach/hooks/useEmail';
import { useIdentities } from '@/features/outreach/hooks/useIdentities';
import {
  useGeneratePersonalization, useSendDirect, type PersonalizeOutcome,
} from '@/features/outreach/hooks/usePersonalize';
import {
  ConfidenceBar, EmailStatusBadge, EmptyState, ErrorState, PageHeader, SourceBadge,
} from '@/features/outreach/components/indicators';
import { errorMessage } from '@/features/outreach/errors';
import { OBJECTIVE_LABELS } from '@/features/outreach/types';
import type { Contact, Objective, OutreachReadyRow } from '@/features/outreach/types';

const ANY = '__none__';
const OBJECTIVES = Object.keys(OBJECTIVE_LABELS) as Objective[];

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

/**
 * Compose and send one email to one lead, outside of a campaign.
 *
 * Generation and sending are deliberately separate steps: Generate only ever
 * fills the subject/body fields, never sends anything, so a bad or declined
 * generation costs nothing but a re-click. Send always goes through the same
 * guarded path a campaign uses (see functions/api/outreach/send.js) — an
 * individual send is still one contact, still subject to suppression,
 * do-not-contact, and every other check.
 */
function ComposePanel({ business, contacts }: {
  business: { id: string; name: string; niche_id: string | null; site_extract: string | null };
  contacts: Contact[];
}) {
  const { data: templates } = useTemplates();
  const { data: identities } = useIdentities();
  const generate = useGeneratePersonalization();
  const send = useSendDirect();

  const sendable = useMemo(() => contacts.filter(c => c.email), [contacts]);

  const [contactId, setContactId] = useState('');
  const [objective, setObjective] = useState<Objective>('reply');
  const [templateId, setTemplateId] = useState(ANY);
  const [identityId, setIdentityId] = useState(ANY);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [lastOutcome, setLastOutcome] = useState<PersonalizeOutcome | null>(null);

  // Default to the first sendable contact once contacts load, without
  // clobbering a selection the user already made.
  useEffect(() => {
    if (!contactId && sendable.length > 0) setContactId(sendable[0].id);
  }, [contactId, sendable]);

  const contact = sendable.find(c => c.id === contactId) ?? null;
  const template = templates?.find(t => t.id === templateId);

  const handleFillTemplate = () => {
    if (!template || !contact) return;
    // renderTemplate wants an OutreachReadyRow shape; only the fields it
    // actually reads matter — the rest are placeholders this component has no
    // use for. See src/features/outreach/hooks/useEmail.ts.
    const lead: OutreachReadyRow = {
      contact_id: contact.id, business_id: business.id, niche: null,
      business_name: business.name, website: null, domain: null,
      formatted_address: null, phone: null, rating: null, ratings_total: null,
      full_name: contact.full_name, role: contact.role, email: contact.email ?? '',
      email_status: contact.email_status, source: contact.source,
      source_url: contact.source_url, confidence: contact.confidence,
      last_contacted_at: null,
    };
    setSubject(renderTemplate(template.subject, lead));
    setBody(renderTemplate(template.body, lead));
    setLastOutcome(null);
  };

  const handleGenerate = async () => {
    if (!contact) return toast.error('Pick a contact first.');
    try {
      const outcome = await generate.mutateAsync({
        contactId: contact.id, objective,
        templateId: templateId === ANY ? null : templateId,
      });
      setLastOutcome(outcome);
      if (outcome.ok) {
        setSubject(outcome.subject);
        setBody(outcome.body);
        toast.success('Generated.');
      } else {
        toast.error(`Claude didn't produce an email: ${outcome.reason}`);
        // Give the user something to start from rather than an empty form.
        if (template) handleFillTemplate();
      }
    } catch (e) {
      toast.error(errorMessage(e, 'Generation failed.'));
    }
  };

  const handleSend = async () => {
    if (!contact?.email) return toast.error('That contact has no email address.');
    if (!subject.trim() || !body.trim()) return toast.error('Write a subject and body first.');
    try {
      const result = await send.mutateAsync({
        contactId: contact.id,
        nicheId: business.niche_id,
        toEmail: contact.email,
        subject: subject.trim(),
        body: body.trim(),
        objective,
        personalized: lastOutcome?.ok === true,
        personalizationModel: lastOutcome?.ok === true ? lastOutcome.model : null,
        identityId: identityId === ANY ? null : identityId,
      });
      if (result.sent > 0) {
        toast.success(`Sent to ${contact.email}.`);
        setSubject(''); setBody(''); setLastOutcome(null);
      } else {
        toast.error(
          result.failed > 0 ? 'Send failed — check the campaign log.' : 'Not sent — a safety check skipped it.',
        );
      }
    } catch (e) {
      toast.error(errorMessage(e, 'Could not send that email.'));
    }
  };

  if (sendable.length === 0) {
    return (
      <section className="o-panel mt-6 p-4">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Compose</h2>
        <p className="text-xs text-muted-foreground">
          No contact here has an email address to send to.
        </p>
      </section>
    );
  }

  return (
    <section className="o-panel mt-6 space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Compose</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {business.site_extract
            ? `Using ${business.site_extract.length.toLocaleString()} characters of site content for personalization.`
            : "No site content captured for this business yet — Claude will personalize from the business name only. Re-run this niche with website enrichment on for a better result."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Contact</Label>
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {sendable.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name ? `${c.full_name} — ${c.email}` : c.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Objective</Label>
          <Select value={objective} onValueChange={v => setObjective(v as Objective)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OBJECTIVES.map(o => <SelectItem key={o} value={o}>{OBJECTIVE_LABELS[o]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Angle (optional template)</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue placeholder="None — write from scratch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>None — write from scratch</SelectItem>
              {(templates ?? []).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Sender</Label>
          <Select value={identityId} onValueChange={setIdentityId}>
            <SelectTrigger><SelectValue placeholder="Auto-pick from the pool" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Auto-pick from the pool</SelectItem>
              {(identities ?? []).filter(i => i.active).map(i => (
                <SelectItem key={i.id} value={i.id}>{i.label} — {i.from_email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={generate.isPending || !contact} onClick={() => void handleGenerate()}>
          {generate.isPending ? 'Generating…' : 'Generate with Claude'}
        </Button>
        {template && (
          <Button size="sm" variant="outline" onClick={handleFillTemplate}>
            Fill from template
          </Button>
        )}
        {lastOutcome?.ok && (
          <span className="o-pill o-pill-verified self-center">
            personalized · {lastOutcome.model}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="compose-subject">Subject</Label>
          <Input id="compose-subject" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="compose-body">Body</Label>
          <Textarea id="compose-body" rows={10} className="font-mono text-sm"
            value={body} onChange={e => setBody(e.target.value)} />
        </div>
      </div>

      <Button disabled={send.isPending || !subject.trim() || !body.trim()} onClick={() => void handleSend()}>
        {send.isPending ? 'Sending…' : `Send to ${contact?.email ?? '…'}`}
      </Button>
    </section>
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

      <ComposePanel business={business} contacts={contacts ?? []} />
    </div>
  );
}
