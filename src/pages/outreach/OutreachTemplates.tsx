import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  MERGE_FIELDS, renderTemplate, useDeleteTemplate, useSaveTemplate, useTemplates,
} from '@/features/outreach/hooks/useEmail';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';
import { errorMessage } from '@/features/outreach/errors';
import type { EmailTemplate, OutreachReadyRow } from '@/features/outreach/types';

/** Stand-in lead so the preview shows real merge output while you type. */
const SAMPLE = {
  contact_id: 'sample', business_id: 'sample', niche: 'kappers-rotterdam',
  business_name: 'KURO hair', website: null, domain: 'kuro-hair.com',
  formatted_address: 'Meent 2, 3011 KL Rotterdam', phone: null, rating: null, ratings_total: null,
  full_name: 'Bianca van Zwieten', role: 'founder', email: 'bianca@kuro-hair.com',
  email_status: 'verified', source: 'website', source_url: null, confidence: 1, last_contacted_at: null,
} as OutreachReadyRow;

const BLANK = { name: '', subject: '', body: '' };

export default function OutreachTemplates() {
  const { data: templates, isLoading, error } = useTemplates();
  const save = useSaveTemplate();
  const remove = useDeleteTemplate();

  const [draft, setDraft] = useState<{ id?: string; name: string; subject: string; body: string }>(BLANK);

  const edit = (t: EmailTemplate) =>
    setDraft({ id: t.id, name: t.name, subject: t.subject, body: t.body });

  const handleSave = async () => {
    if (!draft.name.trim() || !draft.subject.trim() || !draft.body.trim()) {
      toast.error('Name, subject, and body are all required.');
      return;
    }
    try {
      await save.mutateAsync(draft);
      toast.success(draft.id ? 'Template saved.' : 'Template created.');
      setDraft(BLANK);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save the template.'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success('Template deleted.');
      if (draft.id === id) setDraft(BLANK);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not delete that template.'));
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Outreach"
        title="Templates"
        sub="Write once, personalise per lead. Merge fields are filled in when a campaign is queued, so what you preview is what goes out."
      />

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Editor */}
        <div className="o-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{draft.id ? 'Edit template' : 'New template'}</h2>
            {draft.id && (
              <Button variant="ghost" size="sm" onClick={() => setDraft(BLANK)}>Cancel edit</Button>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Name</Label>
              <Input id="t-name" value={draft.name} placeholder="Intro — short"
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-subject">Subject</Label>
              <Input id="t-subject" value={draft.subject} placeholder="Quick question about {{business_name}}"
                onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-body">Body</Label>
              <Textarea id="t-body" rows={12} value={draft.body} placeholder="Hi {{first_name}}, …"
                onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Insert:</span>
              {MERGE_FIELDS.map(f => (
                <button key={f} type="button" className="o-pill o-pill-neutral"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setDraft(d => ({ ...d, body: `${d.body}{{${f}}}` }))}>
                  {`{{${f}}}`}
                </button>
              ))}
            </div>

            <Button onClick={() => void handleSave()} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : draft.id ? 'Save template' : 'Create template'}
            </Button>
          </div>
        </div>

        {/* Live preview + list */}
        <div className="space-y-5">
          <div className="o-panel p-5">
            <h2 className="mb-3 text-sm font-semibold">Preview</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Rendered against a sample lead ({SAMPLE.business_name}).
            </p>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="mb-2 text-sm font-medium">
                {draft.subject ? renderTemplate(draft.subject, SAMPLE) : <span className="text-muted-foreground">Subject…</span>}
              </p>
              <p className="whitespace-pre-wrap text-[0.83rem] leading-relaxed text-muted-foreground">
                {draft.body ? renderTemplate(draft.body, SAMPLE) : 'Body…'}
              </p>
            </div>
          </div>

          <div className="o-panel p-5">
            <h2 className="mb-3 text-sm font-semibold">Saved templates</h2>
            {error ? (
              <ErrorState error={error} />
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !templates || templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet — create one on the left.</p>
            ) : (
              <div className="space-y-2">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.subject}</p>
                    </div>
                    <div className="flex flex-shrink-0 gap-1">
                      <Button variant="ghost" size="sm" onClick={() => edit(t)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-destructive"
                        onClick={() => void handleDelete(t.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
