import { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';
import { useHunterBalance, useUsageSummary } from '@/features/outreach/hooks/useUsage';
import type { ProviderTotal, UsageRow } from '@/features/outreach/hooks/useUsage';

/* Same validated chart palette as Analytics — one system, one set of hues. */
const VIZ = { spend: '#cf7d22', ok: '#199e70', track: 'rgba(255,255,255,0.08)', none: '#8a8781' };
const STATUS = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b' };

const RANGES = [7, 30, 90];

const PROVIDER_LABEL: Record<string, string> = {
  hunter: 'Hunter.io',
  anthropic: 'Claude (personalization)',
  google_places: 'Google Places',
  kvk: 'KVK (business register)',
  gmail: 'Gmail (sending)',
  resend: 'Resend (sending)',
  smartlead: 'Smartlead (sending)',
  smtp: 'SMTP (sending)',
  http: 'HTTP provider (sending)',
};

/**
 * Only Hunter sells a fixed monthly allowance, so only Hunter can run out. The
 * other two bill in arrears — they can get expensive but they cannot stop
 * working mid-run, which is a different kind of problem and gets a cost figure
 * rather than a gauge.
 */
const PROVIDER_NOTE: Record<string, string> = {
  hunter: 'Metered — one credit per domain searched, found or not.',
  anthropic: 'Billed per token. Cost is estimated from list prices.',
  google_places: 'Billed per request, including paged continuations.',
  kvk: 'Contract-priced. Two calls per business: a name search, then a profile.',
  gmail: 'Free with the Workspace seat, but capped at 2,000/day per sender.',
  resend: 'Billed per email.',
  smartlead: 'Billed per email on your Smartlead plan.',
  smtp: 'Cost depends on the mailbox provider.',
  http: 'Cost depends on the configured vendor.',
};

/** Providers whose count is a quota reading rather than a bill. */
const QUOTA_NOT_COST = new Set(['gmail']);

const money = (n: number) => (n < 0.01 && n > 0 ? '<$0.01' : `$${n.toFixed(2)}`);
const num = (n: number) => n.toLocaleString('en-GB');

function balanceVerdict(remaining: number, available: number) {
  if (available === 0) return { color: VIZ.none, word: 'no allowance on this plan' };
  const share = remaining / available;
  if (share <= 0.1) return { color: STATUS.critical, word: 'nearly out' };
  if (share <= 0.3) return { color: STATUS.warning, word: 'running low' };
  return { color: STATUS.good, word: 'healthy' };
}

function HunterCard() {
  const { data, isLoading, error } = useHunterBalance();

  if (isLoading) {
    return <div className="o-panel p-4 text-xs text-muted-foreground">Checking Hunter balance…</div>;
  }

  // A failed balance check is not a failed page — the ledger below still works.
  if (error || !data) {
    return (
      <div className="o-panel p-4">
        <div className="text-sm">Hunter balance</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Could not reach the pipeline to check. The consumption figures below still apply —
          they come from our own records, not from Hunter.
        </p>
      </div>
    );
  }

  if (!data.hunterConfigured) {
    return (
      <div className="o-panel p-4">
        <div className="text-sm">Hunter balance</div>
        <p className="mt-1 text-xs text-muted-foreground">
          No <span className="outreach-mono">HUNTER_API_KEY</span> set, so Hunter enrichment is
          off and nothing is being spent.
        </p>
      </div>
    );
  }

  const h = data.hunter;
  if (!h) {
    return (
      <div className="o-panel p-4">
        <div className="text-sm">Hunter balance</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Hunter did not return account details. The key may be invalid.
        </p>
      </div>
    );
  }

  const remaining = Math.max(0, h.searchesAvailable - h.searchesUsed);
  const verdict = balanceVerdict(remaining, h.searchesAvailable);
  const usedShare = h.searchesAvailable > 0 ? h.searchesUsed / h.searchesAvailable : 0;

  return (
    <div className="o-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm">Hunter searches left</div>
          <p className="text-xs text-muted-foreground">
            Live from Hunter{h.planName ? ` · ${h.planName} plan` : ''}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold" style={{ color: verdict.color }}>
            {num(remaining)}
          </div>
          <div className="text-[0.7rem] text-muted-foreground">of {num(h.searchesAvailable)}</div>
        </div>
      </div>

      <div style={{
        marginTop: '0.9rem', height: 8, borderRadius: 4,
        background: VIZ.track, overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(100, usedShare * 100)}%`, height: '100%',
          background: verdict.color, borderRadius: 4,
        }} />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.7rem]">
        <span style={{ color: verdict.color }}>● <span className="text-muted-foreground">{verdict.word}</span></span>
        {h.resetDate && (
          <span className="text-muted-foreground">
            resets {new Date(h.resetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      {h.verificationsAvailable > 0 && (
        <p className="mt-3 text-[0.7rem] text-muted-foreground">
          Verifications: {num(h.verificationsUsed)} / {num(h.verificationsAvailable)} used
        </p>
      )}
    </div>
  );
}

function ProviderCard({ total }: { total: ProviderTotal }) {
  const label = PROVIDER_LABEL[total.provider] ?? total.provider;
  return (
    <div className="o-panel p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">
        {total.costUnknown ? num(total.calls) : money(total.cost)}
      </div>
      <div className="mt-1 text-[0.7rem] text-muted-foreground">
        {QUOTA_NOT_COST.has(total.provider)
          ? `${num(total.calls)} sent · no per-message charge`
          : total.costUnknown
            ? `${num(total.calls)} calls · no rate configured`
            : `${num(total.calls)} calls`}
      </div>
      {total.inputTokens > 0 && (
        <div className="mt-1 text-[0.7rem] text-muted-foreground">
          {num(total.inputTokens)} in / {num(total.outputTokens)} out tokens
        </div>
      )}
      <p className="mt-2 text-[0.65rem] leading-relaxed text-muted-foreground">
        {PROVIDER_NOTE[total.provider] ?? ''}
      </p>
    </div>
  );
}

function describe(row: UsageRow): string {
  const meta = row.meta ?? {};
  if (typeof meta.domain === 'string') return meta.domain;
  if (typeof meta.business === 'string') return meta.business;
  if (typeof meta.query === 'string') return meta.query;
  return row.operation;
}

export default function OutreachUsage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useUsageSummary(days);

  if (error) return <ErrorState error={error} />;

  return (
    <div>
      <PageHeader
        eyebrow="Spend"
        title="API usage"
        sub="What the paid APIs are costing, and how much Hunter allowance is left."
        actions={
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.045)', borderRadius: 10, padding: 2 }}>
            {RANGES.map(r => (
              <button key={r} onClick={() => setDays(r)} className="text-xs"
                style={{
                  padding: '0.35rem 0.7rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: r === days ? 'rgba(247,161,74,0.16)' : 'transparent',
                  color: r === days ? '#f7a14a' : 'rgba(240,233,226,0.62)',
                }}>
                {r} days
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <HunterCard />
        <div className="o-panel p-4">
          <div className="text-xs text-muted-foreground">Estimated spend · last {days} days</div>
          <div className="mt-1 text-2xl font-semibold" style={{ color: VIZ.spend }}>
            {data ? money(data.grandCost) : '—'}
          </div>
          <p className="mt-2 text-[0.65rem] leading-relaxed text-muted-foreground">
            Estimated, not billed. Token and call counts are exact; the prices behind them are
            configured locally, so treat this as a scale check rather than an invoice.
          </p>
        </div>
      </div>

      {isLoading ? (
        <EmptyState title="Loading usage…" />
      ) : data?.isEmpty ? (
        <EmptyState
          title="No API calls recorded in this window."
          hint="Usage is logged from the moment the pipeline runs a crawl or writes an email with Claude."
        />
      ) : data ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.totals.map(t => <ProviderCard key={t.provider} total={t} />)}
          </div>

          <div className="o-panel p-4">
            <div className="mb-1 text-sm">Recent calls</div>
            <p className="mb-3 text-xs text-muted-foreground">
              The last {Math.min(40, data.recent.length)} billable calls, newest first.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="outreach-mono text-[0.7rem] text-muted-foreground">
                      {new Date(row.occurred_at).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-xs">
                      {PROVIDER_LABEL[row.provider] ?? row.provider}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{describe(row)}</TableCell>
                    <TableCell className="o-num text-right text-[0.7rem] text-muted-foreground">
                      {row.input_tokens === null
                        ? '—'
                        : `${num(row.input_tokens)}/${num(row.output_tokens ?? 0)}`}
                    </TableCell>
                    <TableCell className="o-num text-right text-[0.7rem]">
                      {row.cost_usd === null ? '—' : money(Number(row.cost_usd))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </div>
  );
}
