import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useNicheLeadCounts, useNiches, useUpdateNiche,
} from '@/features/outreach/hooks/useOutreach';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';
import type { Niche } from '@/features/outreach/types';

type ToggleKey = 'active' | 'enrich_website' | 'enrich_kvk' | 'guess_email' | 'verify_email';

const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: 'active',         label: 'Active' },
  { key: 'enrich_website', label: 'Website' },
  { key: 'enrich_kvk',     label: 'KVK' },
  { key: 'guess_email',    label: 'Guess' },
  { key: 'verify_email',   label: 'Verify' },
];

export default function OutreachNiches() {
  const { data: niches, isLoading, error } = useNiches();
  const { data: counts } = useNicheLeadCounts();
  const updateNiche = useUpdateNiche();

  const toggle = async (niche: Niche, key: ToggleKey) => {
    try {
      await updateNiche.mutateAsync({ id: niche.id, [key]: !niche[key] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Could not update ${key}.`);
    }
  };

  return (
    <div>
      <PageHeader
        path="niches"
        title="Niches"
        sub="Each niche is one discovery + enrichment config. Toggles save immediately."
        actions={
          <Button asChild size="sm">
            <Link to="/outreach/niches/new">New niche</Link>
          </Button>
        }
      />

      {error ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <EmptyState title="Loading niches…" />
      ) : !niches || niches.length === 0 ? (
        <EmptyState
          title="No niches configured."
          hint="Create one to tell the pipeline what to look for and where."
        />
      ) : (
        <div className="o-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Niche</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Targets</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                {TOGGLES.map(t => (
                  <TableHead key={t.key} className="text-center">{t.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {niches.map(niche => {
                const targets = niche.provider === 'overpass' ? niche.osm_filters : niche.search_queries;
                return (
                  <TableRow key={niche.id}>
                    <TableCell>
                      <Link to={`/outreach/niches/${niche.id}`} className="text-foreground hover:text-primary">
                        {niche.name}
                      </Link>
                      <div className="outreach-mono mt-0.5 text-[0.7rem] text-muted-foreground">
                        npm run run:niche -- {niche.slug}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        {niche.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <span className="outreach-mono text-[0.7rem] text-muted-foreground">
                        {(targets ?? []).join(', ') || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {niche.location_query ?? (
                        niche.center_lat !== null && niche.center_lng !== null ? (
                          <span className="outreach-mono">
                            {niche.center_lat.toFixed(4)}, {niche.center_lng.toFixed(4)}
                          </span>
                        ) : '—'
                      )}
                    </TableCell>
                    <TableCell className="outreach-mono text-right text-xs">
                      {counts?.[niche.slug] ?? 0}
                    </TableCell>
                    {TOGGLES.map(t => (
                      <TableCell key={t.key} className="text-center">
                        <Switch
                          checked={niche[t.key]}
                          disabled={updateNiche.isPending}
                          onCheckedChange={() => void toggle(niche, t.key)}
                          aria-label={`${t.label} for ${niche.name}`}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Runs happen in the pipeline repo, not here — this console only configures and reviews.
      </p>
    </div>
  );
}
