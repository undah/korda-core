// src/features/outreach/hooks/useUsage.ts
//
// What the paid APIs have cost, from two sources that answer different
// questions.
//
// api_usage is our ledger — every billable call the pipeline made, attributable
// to a run and a niche. It is the only source for Google Places and Anthropic,
// neither of which exposes a balance.
//
// The live balance (Hunter only) comes through a Cloudflare proxy because the
// key lives on the pipeline host. It is the number to trust for "how much is
// left": credits spent outside this system — the Hunter web app, another tool
// on the same key — never appear in our ledger, so inferring a balance by
// subtraction would quietly drift.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export interface HunterBalance {
  planName: string | null;
  searchesUsed: number;
  searchesAvailable: number;
  verificationsUsed: number;
  verificationsAvailable: number;
  resetDate: string | null;
}

export interface UsageRow {
  id: string;
  provider: string;
  operation: string;
  units: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  run_id: string | null;
  meta: Record<string, unknown> | null;
  occurred_at: string;
}

export interface ProviderTotal {
  provider: string;
  calls: number;
  units: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  /** True when no row carried a price — the cost column is then meaningless, not zero. */
  costUnknown: boolean;
  lastUsed: string | null;
}

export interface UsageSummary {
  totals: ProviderTotal[];
  recent: UsageRow[];
  /** Per day, for the sparkline: total calls across providers. */
  daily: { date: string; calls: number }[];
  grandCost: number;
  isEmpty: boolean;
}

export function useUsageSummary(days: number) {
  return useQuery({
    queryKey: ['outreach-usage', days],
    staleTime: 30_000,
    queryFn: async (): Promise<UsageSummary> => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from('api_usage')
        .select('*')
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as UsageRow[];

      const byProvider = new Map<string, ProviderTotal>();
      for (const r of rows) {
        let t = byProvider.get(r.provider);
        if (!t) {
          t = {
            provider: r.provider, calls: 0, units: 0,
            inputTokens: 0, outputTokens: 0, cost: 0,
            costUnknown: true, lastUsed: null,
          };
          byProvider.set(r.provider, t);
        }
        t.calls++;
        t.units += Number(r.units ?? 0);
        t.inputTokens += r.input_tokens ?? 0;
        t.outputTokens += r.output_tokens ?? 0;
        if (r.cost_usd !== null) {
          t.cost += Number(r.cost_usd);
          t.costUnknown = false;
        }
        // Rows arrive newest-first, so the first one seen is the latest.
        t.lastUsed ??= r.occurred_at;
      }

      const daily = new Map<string, number>();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        daily.set(d.toISOString().slice(0, 10), 0);
      }
      for (const r of rows) {
        const key = r.occurred_at.slice(0, 10);
        if (daily.has(key)) daily.set(key, (daily.get(key) ?? 0) + 1);
      }

      const totals = [...byProvider.values()].sort((a, b) => b.calls - a.calls);

      return {
        totals,
        recent: rows.slice(0, 40),
        daily: [...daily.entries()].map(([date, calls]) => ({ date, calls })),
        grandCost: totals.reduce((sum, t) => sum + t.cost, 0),
        isEmpty: rows.length === 0,
      };
    },
  });
}

/**
 * Live Hunter balance. Kept separate from the ledger query so a pipeline that
 * is down, or a Hunter key that is unset, degrades to "balance unavailable"
 * rather than taking the whole page's history with it.
 */
export function useHunterBalance() {
  return useQuery({
    queryKey: ['outreach-hunter-balance'],
    staleTime: 120_000,
    retry: false,
    queryFn: async (): Promise<{ hunter: HunterBalance | null; hunterConfigured: boolean }> => {
      const res = await fetch('/api/outreach/usage');
      if (!res.ok) throw new Error(`Balance check failed (${res.status})`);
      return res.json() as Promise<{ hunter: HunterBalance | null; hunterConfigured: boolean }>;
    },
  });
}
