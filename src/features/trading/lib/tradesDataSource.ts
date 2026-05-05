import { supabase } from '@/lib/supabaseClient';

// Normalised trade shape used by Analytics and future dashboards.
// Both Supabase and cTrader data is mapped to this before any metric calculation.
export type TradeEntry = {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  pnl: number;
  pnl_percent: number | null;
  trade_time: string; // ISO string (close time)
  account_type: 'live' | 'backtest';
};

// ── Supabase source ───────────────────────────────────────────────────────────

export async function fetchTradesFromSupabase(
  userId: string,
  accountType: 'live' | 'backtest'
): Promise<TradeEntry[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('id, pair, side, pnl, pnl_percent, account_type, trade_time, created_at')
    .eq('user_id', userId)
    .order('trade_time', { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .filter((r: any) => (r.account_type ?? 'live') === accountType)
    .filter((r: any) => r.pnl !== null && r.pnl !== undefined)
    .map((r: any) => ({
      id: r.id,
      pair: (r.pair ?? 'Unknown').toUpperCase(),
      side: (r.side ?? 'buy') as 'buy' | 'sell',
      pnl: Number(r.pnl ?? 0),
      pnl_percent: r.pnl_percent != null ? Number(r.pnl_percent) : null,
      trade_time: r.trade_time ?? r.created_at,
      account_type: (r.account_type ?? 'live') as 'live' | 'backtest',
    }));
}

// ── cTrader Open API source (ready to enable) ─────────────────────────────────
//
// Docs:  https://help.ctrader.com/open-api/
// Auth:  OAuth2 — POST https://openapi.ctrader.com/apps/token
//        Body: grant_type=client_credentials&client_id=...&client_secret=...
//        Returns: { accessToken, expiresIn }
//
// Deals: GET https://openapi.ctrader.com/apps/ct_id/{ctId}/accounts/{accountId}/history/deals
//        Params: from (ms) · to (ms) · limit (max 1000)
//        Returns: { deals: CtaderDeal[] }
//
// To enable:
//   1. Add VITE_CTRADER_CLIENT_ID and VITE_CTRADER_CLIENT_SECRET to .env
//   2. Uncomment the block below
//   3. In Analytics.tsx swap fetchTradesFromSupabase → fetchTradesFromCTrader

/*
const CTRADER_BASE = 'https://openapi.ctrader.com/apps';

type CtaderDeal = {
  dealId: number;
  symbolName: string;              // e.g. "EURUSD"
  tradeSide: 'BUY' | 'SELL';
  netProfit: number;               // in deposit currency
  grossProfit: number;
  commission: number;
  swap: number;
  volume: number;                  // in 1/100 lots
  openTimestamp: number;           // ms UTC
  closeTimestamp: number;          // ms UTC
};

function normalizeCtraderDeal(deal: CtaderDeal): TradeEntry {
  return {
    id: String(deal.dealId),
    pair: deal.symbolName.replace(/[^A-Z0-9]/g, ''),
    side: deal.tradeSide === 'BUY' ? 'buy' : 'sell',
    pnl: deal.netProfit,
    pnl_percent: null,
    trade_time: new Date(deal.closeTimestamp).toISOString(),
    account_type: 'live',
  };
}

async function getCtraderToken(): Promise<string> {
  const res = await fetch('https://openapi.ctrader.com/apps/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: import.meta.env.VITE_CTRADER_CLIENT_ID,
      client_secret: import.meta.env.VITE_CTRADER_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`cTrader auth failed: ${res.status}`);
  const { accessToken } = await res.json();
  return accessToken;
}

export async function fetchTradesFromCTrader(
  ctId: string,
  accountId: string,
  fromMs: number,
  toMs: number
): Promise<TradeEntry[]> {
  const token = await getCtraderToken();
  const res = await fetch(
    `${CTRADER_BASE}/ct_id/${ctId}/accounts/${accountId}/history/deals?from=${fromMs}&to=${toMs}&limit=1000`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`cTrader deals failed: ${res.status}`);
  const { deals } = await res.json();
  return (deals as CtaderDeal[])
    .filter(d => d.closeTimestamp > 0)
    .map(normalizeCtraderDeal);
}
*/
