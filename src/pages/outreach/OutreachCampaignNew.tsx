import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useLeads, useNiches } from '@/features/outreach/hooks/useOutreach';
import {
  dedupeRecipients, renderTemplate, useCreateCampaign, useTemplates,
} from '@/features/outreach/hooks/useEmail';
import {
  EmailStatusBadge, EmptyState, ErrorState, PageHeader,
} from '@/features/outreach/components/indicators';
import type { EmailStatus, SequenceStepDraft } from '@/features/outreach/types';

const ANY = '__any__';

export default function OutreachCampaignNew() {
  const navigate = useNavigate();
  const { data: niches } = useNiches();
  const { data: templates, isLoading: templatesLoading } = useTemplates();
  const createCampaign = useCreateCampaign();

  const [name, setName] = useState('');
  // Step 1 is the initial mail; its delay is fixed at 0 and ignored on save.
  const [steps, setSteps] = useState<SequenceStepDraft[]>([{ template_id: '', delay_days: 0 }]);
  const [niche, setNiche] = useState<string>(ANY);
  const [status, setStatus] = useState<string>(ANY);
  const [minConfidence, setMinConfidence] = useState<string>(ANY);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // Recipients come from outreach_ready, which already excludes suppressed,
  // bounced, and do-not-contact rows — so the pool is safe by construction.
  const { data, isLoading, error } = useLeads({
    niche: niche === ANY ? undefined : niche,
    emailStatus: status === ANY ? undefined : (status as EmailStatus),
    minConfidence: minConfidence === ANY ? undefined : Number(minConfidence),
    page: 1,
  });

  const setStep = (index: number, patch: Partial<SequenceStepDraft>) =>
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  // Stable reference so the recipients memo below doesn't recompute every render.
  const pool = useMemo(() => data?.rows ?? [], [data]);

  // Resolved steps — every step needs a template before the campaign can queue.
  const resolvedSteps = steps.map(s => ({
    template: templates?.find(t => t.id === s.template_id),
    delay_days: s.delay_days,
  }));
  const stepsReady = resolvedSteps.every(s => s.template);
  const template = resolvedSteps[0]?.template;

  const eligible = useMemo(
    () => pool.filter(r => !excluded.has(r.contact_id) && !r.last_contacted_at),
    [pool, excluded],
  );
  // One lead is one contact, not one company, so the pool can hold the same
  // business (or the same address) more than once. Collapse here as well as at
  // queue time so the count on the button is the count that actually sends.
  const recipients = useMemo(() => dedupeRecipients(eligible), [eligible]);
  const collapsed = eligible.length - recipients.length;
  const keptIds = useMemo(() => new Set(recipients.map(r => r.contact_id)), [recipients]);
  const alreadyContacted = pool.filter(r => r.last_contacted_at).length;

  const toggle = (id: string) =>
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Give the campaign a name.');
    if (!stepsReady) return toast.error('Every step needs a template.');
    if (recipients.length === 0) return toast.error('No recipients selected.');
    try {
      const campaign = await createCampaign.mutateAsync({
        name: name.trim(),
        steps: resolvedSteps.map(s => ({ template: s.template!, delay_days: s.delay_days })),
        recipients,
      });
      toast.success(
        `Queued ${recipients.length * steps.length} message${recipients.length * steps.length === 1 ? '' : 's'}.`,
        { description: 'Nothing sends until you start the campaign.' },
      );
      navigate(`/outreach/campaigns/${campaign.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the campaign.');
    }
  };

  const preview = template && recipients[0] ? {
    subject: renderTemplate(template.subject, recipients[0]),
    body: renderTemplate(template.body, recipients[0]),
    to: recipients[0].email,
  } : null;

  return (
    <div>
      <Link to="/outreach/campaigns" className="text-xs text-muted-foreground hover:text-foreground">
        ← Back to campaigns
      </Link>

      <div className="mt-3">
        <PageHeader
          eyebrow="Outreach"
          title="New campaign"
          sub="Pick a template, filter the lead pool, review, then queue. Nothing sends until you press send."
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          {/* Setup */}
          <div className="o-panel p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Campaign name</Label>
                <Input id="c-name" value={name} placeholder="Kappers Rotterdam — intro"
                  onChange={e => setName(e.target.value)} />
              </div>
            </div>
            {(!templates || templates.length === 0) && !templatesLoading && (
              <p className="mt-3 text-xs text-muted-foreground">
                No templates yet — <Link to="/outreach/templates" className="text-primary">create one first</Link>.
              </p>
            )}
          </div>

          {/* Sequence */}
          <div className="o-panel p-5">
            <h2 className="mb-1 text-sm font-semibold">Sequence</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Most replies come from a follow-up rather than the first email. Anyone who replies is
              dropped from the remaining steps automatically.
            </p>

            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="flex flex-wrap items-end gap-3">
                  <div className="w-14 shrink-0">
                    <Label className="text-[0.7rem] text-muted-foreground">Step</Label>
                    <div className="o-num pt-2 text-sm">{i + 1}</div>
                  </div>
                  <div className="min-w-[190px] flex-1 space-y-1.5">
                    <Label className="text-[0.7rem] text-muted-foreground">Template</Label>
                    <Select value={step.template_id}
                      onValueChange={v => setStep(i, { template_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder={templatesLoading ? 'Loading…' : 'Pick a template'} />
                      </SelectTrigger>
                      <SelectContent>
                        {(templates ?? []).map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32 space-y-1.5">
                    <Label className="text-[0.7rem] text-muted-foreground">
                      {i === 0 ? 'Sends' : 'Days after'}
                    </Label>
                    {i === 0 ? (
                      <div className="pt-2 text-xs text-muted-foreground">on start</div>
                    ) : (
                      <Input className="outreach-mono" value={step.delay_days}
                        onChange={e => setStep(i, { delay_days: Math.max(0, Number(e.target.value) || 0) })} />
                    )}
                  </div>
                  {steps.length > 1 && i > 0 && (
                    <Button variant="ghost" size="sm" className="text-destructive"
                      onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" className="mt-4"
              onClick={() => setSteps([...steps, { template_id: '', delay_days: 3 }])}>
              Add follow-up
            </Button>
          </div>

          {/* Audience */}
          <div className="o-panel p-5">
            <h2 className="mb-3 text-sm font-semibold">Audience</h2>
            <div className="mb-4 flex flex-wrap gap-2">
              <Select value={niche} onValueChange={setNiche}>
                <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All niches</SelectItem>
                  {(niches ?? []).map(n => <SelectItem key={n.id} value={n.slug}>{n.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any status</SelectItem>
                  {(['verified', 'guessed', 'unverified'] as EmailStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={minConfidence} onValueChange={setMinConfidence}>
                <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any confidence</SelectItem>
                  {['0.4', '0.6', '0.8'].map(c => <SelectItem key={c} value={c}>≥ {c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {error ? (
              <ErrorState error={error} />
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground">Loading leads…</p>
            ) : pool.length === 0 ? (
              <EmptyState title="No leads match these filters." hint="Loosen the filters, or run a niche first." />
            ) : (
              <div className="max-h-[420px] overflow-y-auto rounded-lg border border-white/8">
                {pool.map(lead => {
                  const contacted = Boolean(lead.last_contacted_at);
                  const on = !excluded.has(lead.contact_id) && !contacted;
                  // Ticked but losing the de-dup to a higher-confidence row for
                  // the same business or address. Still togglable — unticking
                  // the winner promotes this one.
                  const duplicate = on && !keptIds.has(lead.contact_id);
                  return (
                    <label key={lead.contact_id}
                      className="flex cursor-pointer items-center gap-3 border-b border-white/5 px-3 py-2 last:border-b-0 hover:bg-white/[0.03]">
                      <Checkbox checked={on && !duplicate} disabled={contacted}
                        onCheckedChange={() => toggle(lead.contact_id)} />
                      <span className={`min-w-0 flex-1 ${duplicate ? 'opacity-50' : ''}`}>
                        <span className="block truncate text-sm">{lead.business_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {lead.full_name ? `${lead.full_name} · ` : ''}{lead.email}
                        </span>
                      </span>
                      {contacted
                        ? <span className="o-pill o-pill-neutral">already contacted</span>
                        : duplicate
                          ? <span className="o-pill o-pill-neutral">duplicate</span>
                          : <EmailStatusBadge status={lead.email_status} />}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Review */}
        <div className="space-y-5">
          <div className="o-panel p-5">
            <h2 className="mb-3 text-sm font-semibold">Review</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Recipients</dt>
                <dd className="o-num font-medium">{recipients.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Excluded by you</dt>
                <dd className="o-num text-muted-foreground">{excluded.size}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Already contacted</dt>
                <dd className="o-num text-muted-foreground">{alreadyContacted}</dd>
              </div>
              {collapsed > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Duplicate business or address</dt>
                  <dd className="o-num text-muted-foreground">{collapsed}</dd>
                </div>
              )}
            </dl>
            {steps.length > 1 && (
              <div className="mt-2 flex justify-between border-t border-white/8 pt-2 text-sm">
                <dt className="text-muted-foreground">Emails queued</dt>
                <dd className="o-num font-medium">
                  {recipients.length} × {steps.length} steps = {recipients.length * steps.length}
                </dd>
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Suppressed, bounced, and do-not-contact leads are already excluded from this pool, and
              every check runs again at send time. Each email includes an unsubscribe link.
            </p>
            <Button className="mt-4 w-full"
              disabled={createCampaign.isPending || !stepsReady || recipients.length === 0}
              onClick={() => void handleCreate()}>
              {createCampaign.isPending
                ? 'Queueing…'
                : `Queue ${recipients.length * steps.length} message${recipients.length * steps.length === 1 ? '' : 's'}`}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Queueing does not send. You start the campaign from its own page.
            </p>
          </div>

          {preview && (
            <div className="o-panel p-5">
              <h2 className="mb-1 text-sm font-semibold">Preview</h2>
              <p className="mb-3 text-xs text-muted-foreground">First recipient: {preview.to}</p>
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <p className="mb-2 text-sm font-medium">{preview.subject}</p>
                <p className="whitespace-pre-wrap text-[0.83rem] leading-relaxed text-muted-foreground">{preview.body}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
