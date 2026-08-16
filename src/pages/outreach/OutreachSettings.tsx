import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useOutreachProfile, useSaveOutreachProfile } from '@/features/outreach/hooks/usePersonalize';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';
import { errorMessage } from '@/features/outreach/errors';
import type { OutreachProfile } from '@/features/outreach/types';

type Draft = Omit<OutreachProfile, 'id' | 'updated_at'>;

const EMPTY: Draft = {
  company_name: '', offer: '', proof_points: '', tone: '', language: 'nl',
  sender_name: '', constraints: '',
};

export default function OutreachSettings() {
  const { data: profile, isLoading, error } = useOutreachProfile();
  const save = useSaveOutreachProfile();

  const [draft, setDraft] = useState<Draft>(EMPTY);

  useEffect(() => {
    if (profile) {
      const { id: _ignored, updated_at: _updated, ...rest } = profile;
      setDraft(rest);
    }
  }, [profile]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft(d => ({ ...d, [key]: value }));

  const handleSave = async () => {
    try {
      await save.mutateAsync({ id: profile?.id, ...draft });
      toast.success('Profile saved.');
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save the profile.'));
    }
  };

  if (error) return <ErrorState error={error} />;
  if (isLoading) return <EmptyState title="Loading settings…" />;

  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow="AI personalization"
        title="Settings"
        sub="What we sell, said once. Claude reads this alongside each lead's site content — the more specific this is, the less generic every generated email sounds."
      />

      <div className="space-y-6">
        <section className="o-panel space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="company">Company name</Label>
              <Input id="company" value={draft.company_name}
                onChange={e => set('company_name', e.target.value)} placeholder="Korda" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sender">Sender name</Label>
              <Input id="sender" value={draft.sender_name}
                onChange={e => set('sender_name', e.target.value)} placeholder="Gijs" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="offer">What we sell</Label>
            <Textarea id="offer" rows={3} value={draft.offer}
              onChange={e => set('offer', e.target.value)}
              placeholder="AI automation for small businesses — we build the specific workflow, not a generic chatbot." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proof">Proof points</Label>
            <Textarea id="proof" rows={3} value={draft.proof_points}
              onChange={e => set('proof_points', e.target.value)}
              placeholder="Results, client names, numbers Claude may reference." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tone">Tone</Label>
              <Input id="tone" value={draft.tone}
                onChange={e => set('tone', e.target.value)}
                placeholder="Direct, no hype, short sentences" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="language">Language</Label>
              <Input id="language" className="outreach-mono" value={draft.language}
                onChange={e => set('language', e.target.value)} placeholder="nl" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="constraints">Hard constraints</Label>
            <Textarea id="constraints" rows={3} value={draft.constraints}
              onChange={e => set('constraints', e.target.value)}
              placeholder="Never mention pricing. Always offer a short call, not a demo." />
            <p className="text-xs text-muted-foreground">
              Rules the model must never violate — it's told these are hard constraints, not
              suggestions.
            </p>
          </div>
        </section>

        <Button disabled={save.isPending} onClick={() => void handleSave()}>
          {save.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </div>
  );
}
