import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  useCreateNiche, useDeleteNiche, useNiche, useUpdateNiche,
} from '@/features/outreach/hooks/useOutreach';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';
import { errorMessage } from '@/features/outreach/errors';
import type { NicheDraft, NicheProvider } from '@/features/outreach/types';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const EMPTY: NicheDraft = {
  slug: '', name: '', active: true, provider: 'google',
  search_queries: [], osm_filters: [],
  location_query: null, center_lat: null, center_lng: null,
  radius_m: 15000, language_code: 'nl', region_code: 'NL', max_results: 60,
  min_rating: null, min_ratings_total: null,
  require_website: true, require_phone: false, included_type: null,
  enrich_website: true, enrich_kvk: false, enrich_hunter: false,
  hunter_max_lookups: null, guess_email: false, verify_email: false,
  send_cap_per_day: null, recrawl_after_days: 30,
};

/** Comma-separated text ⇄ string[] for the array columns. */
const toList = (value: string): string[] =>
  value.split(',').map(s => s.trim()).filter(Boolean);
const fromList = (list: string[] | null): string => (list ?? []).join(', ');

const toNum = (value: string): number | null => {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export default function OutreachNicheForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { data: existing, isLoading, error } = useNiche(id);
  const createNiche = useCreateNiche();
  const updateNiche = useUpdateNiche();
  const deleteNiche = useDeleteNiche();

  const [draft, setDraft] = useState<NicheDraft>(EMPTY);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (existing) {
      const { id: _ignored, ...rest } = existing;
      setDraft(rest);
    }
  }, [existing]);

  const set = <K extends keyof NicheDraft>(key: K, value: NicheDraft[K]) =>
    setDraft(d => ({ ...d, [key]: value }));

  const validate = (): string | null => {
    if (!draft.name.trim()) return 'Give the niche a name.';
    if (!SLUG_RE.test(draft.slug)) return 'Slug must be url-safe: lowercase letters, numbers, hyphens.';
    if (draft.provider === 'google' && draft.search_queries.length === 0) {
      return 'Google discovery needs at least one search query.';
    }
    if (draft.provider === 'overpass') {
      if (draft.osm_filters.length === 0) return 'Overpass discovery needs at least one OSM filter.';
      if (draft.center_lat === null || draft.center_lng === null) {
        return 'Overpass discovery needs both centre coordinates.';
      }
    }
    return null;
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) { toast.error(problem); return; }

    try {
      if (isEdit && id) {
        await updateNiche.mutateAsync({ id, ...draft });
        toast.success('Niche saved.');
      } else {
        await createNiche.mutateAsync(draft);
        toast.success('Niche created.');
      }
      navigate('/outreach/niches');
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save the niche.'));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteNiche.mutateAsync(id);
      toast.success('Niche deleted.');
      navigate('/outreach/niches');
    } catch (e) {
      toast.error(errorMessage(e, 'Could not delete the niche.'));
    }
  };

  if (error) return <ErrorState error={error} />;
  if (isEdit && isLoading) return <EmptyState title="Loading niche…" />;
  if (isEdit && !isLoading && !existing) {
    return <EmptyState title="That niche doesn't exist." hint="It may have been deleted." />;
  }

  const saving = createNiche.isPending || updateNiche.isPending;
  const isGoogle = draft.provider === 'google';

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow={isEdit ? 'Edit config' : 'New config'}
        title={isEdit ? 'Edit niche' : 'New niche'}
        sub="Discovery source, targets, and which enrichment steps the pipeline should run."
      />

      <div className="space-y-6">
        {/* Identity */}
        <section className="o-panel space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={draft.name}
                onChange={e => set('name', e.target.value)} placeholder="Kappers Rotterdam" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" className="outreach-mono" value={draft.slug}
                onChange={e => set('slug', e.target.value)} placeholder="kappers-rotterdam" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={draft.provider} onValueChange={v => set('provider', v as NicheProvider)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google Places</SelectItem>
                  <SelectItem value="overpass">Overpass (OSM)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3 pb-1">
              <Switch id="active" checked={draft.active} onCheckedChange={v => set('active', v)} />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
        </section>

        {/* Targets — provider-aware */}
        <section className="o-panel space-y-4 p-4">
          {isGoogle ? (
            <div className="space-y-1.5">
              <Label htmlFor="queries">Search queries</Label>
              <Input id="queries" className="outreach-mono" value={fromList(draft.search_queries)}
                onChange={e => set('search_queries', toList(e.target.value))}
                placeholder="kapper, hair salon, barbershop" />
              <p className="text-xs text-muted-foreground">Comma-separated. Each is searched separately.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="filters">OSM filters</Label>
              <Input id="filters" className="outreach-mono" value={fromList(draft.osm_filters)}
                onChange={e => set('osm_filters', toList(e.target.value))}
                placeholder="shop=hairdresser, amenity=cafe" />
              <p className="text-xs text-muted-foreground">
                Comma-separated <span className="outreach-mono">key=value</span> tags.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={draft.location_query ?? ''}
                onChange={e => set('location_query', e.target.value || null)} placeholder="Rotterdam" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lat">Centre latitude</Label>
              <Input id="lat" className="outreach-mono" value={draft.center_lat ?? ''}
                onChange={e => set('center_lat', toNum(e.target.value))} placeholder="51.9244" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lng">Centre longitude</Label>
              <Input id="lng" className="outreach-mono" value={draft.center_lng ?? ''}
                onChange={e => set('center_lng', toNum(e.target.value))} placeholder="4.4777" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="radius">Radius (m)</Label>
              <Input id="radius" className="outreach-mono" value={draft.radius_m}
                onChange={e => set('radius_m', toNum(e.target.value) ?? 0)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max">Max results</Label>
              <Input id="max" className="outreach-mono" value={draft.max_results}
                onChange={e => set('max_results', toNum(e.target.value) ?? 0)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recrawl">Recrawl after (days)</Label>
              <Input id="recrawl" className="outreach-mono" value={draft.recrawl_after_days}
                onChange={e => set('recrawl_after_days', toNum(e.target.value) ?? 0)} />
            </div>
          </div>
        </section>

        {/* Quality gates */}
        <section className="o-panel space-y-4 p-4">
          {isGoogle ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="minRating">Min rating</Label>
                <Input id="minRating" className="outreach-mono" value={draft.min_rating ?? ''}
                  onChange={e => set('min_rating', toNum(e.target.value))} placeholder="4.0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minTotal">Min review count</Label>
                <Input id="minTotal" className="outreach-mono" value={draft.min_ratings_total ?? ''}
                  onChange={e => set('min_ratings_total', toNum(e.target.value))} placeholder="10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Included type</Label>
                <Input id="type" className="outreach-mono" value={draft.included_type ?? ''}
                  onChange={e => set('included_type', e.target.value || null)} placeholder="hair_care" />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              OpenStreetMap has no ratings or review counts, so rating filters don't apply to this provider.
            </p>
          )}

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3">
              <Switch id="reqWeb" checked={draft.require_website}
                onCheckedChange={v => set('require_website', v)} />
              <Label htmlFor="reqWeb">Require website</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="reqPhone" checked={draft.require_phone}
                onCheckedChange={v => set('require_phone', v)} />
              <Label htmlFor="reqPhone">Require phone</Label>
            </div>
          </div>
        </section>

        {/* Enrichment */}
        <section className="o-panel space-y-4 p-4">
          <div className="flex flex-wrap gap-6">
            {([
              ['enrich_website', 'Crawl website'],
              ['enrich_kvk', 'KVK lookup'],
              ['enrich_hunter', 'Hunter.io'],
              ['guess_email', 'Guess emails'],
              ['verify_email', 'Verify (MX)'],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <Switch id={key} checked={draft[key]} onCheckedChange={v => set(key, v)} />
                <Label htmlFor={key}>{label}</Label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Guessed addresses are marked <span className="outreach-mono">guessed</span> and are not verified —
            expect bounces if you send to them unchecked.
          </p>
          {draft.enrich_hunter && (
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="hunterCap">Hunter lookups per run</Label>
              <Input id="hunterCap" className="outreach-mono"
                value={draft.hunter_max_lookups ?? ''}
                onChange={e => set('hunter_max_lookups', toNum(e.target.value))}
                placeholder="pipeline default" />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Hunter.io finds the name and job title behind a domain, which is how you get an owner
            instead of another <span className="outreach-mono">info@</span>. It costs one credit per
            business looked up, so it skips any business that already has a named contact. Leave the
            cap blank to use the pipeline default; <span className="outreach-mono">0</span> looks
            nothing up. Credits are billed per business searched, found or not — on Hunter's free
            tier the whole month is 25.
          </p>
        </section>

        <div className="flex items-center gap-2">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save niche'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/outreach/niches')}>Cancel</Button>
          {isEdit && (
            <Button variant="ghost" className="ml-auto text-destructive"
              onClick={() => setConfirmOpen(true)}>
              Delete niche
            </Button>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this niche?</DialogTitle>
            <DialogDescription>
              The niche config is removed. Businesses and contacts already discovered stay — they just
              lose their link to this niche.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteNiche.isPending}
              onClick={() => void handleDelete()}>
              {deleteNiche.isPending ? 'Deleting…' : 'Delete niche'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
