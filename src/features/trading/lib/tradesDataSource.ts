import { supabase } from '@/lib/supabaseClient';

// Normalised trade shape used by Analytics and future dashboards.
export type TradeEntry = {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  pnl: number;
  pnl_percent: number | null;
  trade_time: string;       // ISO string (close time)
  open_time: string | null; // ISO string (open time) — for session classification
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
      open_time: null,
      account_type: (r.account_type ?? 'live') as 'live' | 'backtest',
    }));
}

// ── cTrader Open API ──────────────────────────────────────────────────────────

const CTRADER_BASE = 'https://openapi.ctrader.com/apps';

export type CTraderAccount = {
  ctidTraderAccountId: number;
  ctid?: number;
  isLive?: boolean;
  brokerTitle?: string;
  traderLogin?: number;
};

type CTraderRawDeal = {
  dealId: number;
  symbolName: string;
  tradeSide: 'BUY' | 'SELL';
  netProfit: number;
  grossProfit?: number;
  commission?: number;
  swap?: number;
  volume?: number;
  openTimestamp?: number; // ms UTC
  closeTimestamp: number; // ms UTC
};

export async function getCtraderToken(): Promise<string> {
  const res = await fetch(`${CTRADER_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: import.meta.env.VITE_CTRADER_CLIENT_ID ?? '',
      client_secret: import.meta.env.VITE_CTRADER_CLIENT_SECRET ?? '',
    }),
  });
  if (!res.ok) throw new Error(`cTrader auth failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  const token = json.accessToken ?? json.access_token;
  if (!token) throw new Error('cTrader auth: no accessToken in response');
  return token;
}

export async function fetchCTraderAccounts(token: string): Promise<CTraderAccount[]> {
  const res = await fetch(`${CTRADER_BASE}/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`cTrader accounts failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  // Handle { accounts: [...] } or { data: [...] } or plain array
  const list: any[] = Array.isArray(json) ? json : (json.accounts ?? json.data ?? []);
  return list.map((a: any) => ({
    ctidTraderAccountId: a.ctidTraderAccountId ?? a.accountId ?? a.id,
    ctid: a.ctid ?? a.ctId,
    isLive: a.isLive ?? a.live,
    brokerTitle: a.brokerTitle ?? a.broker,
    traderLogin: a.traderLogin ?? a.login,
  }));
}

export async function fetchDealsFromCTrader(
  token: string,
  account: CTraderAccount,
  fromMs: number,
  toMs: number
): Promise<TradeEntry[]> {
  const accountId = account.ctidTraderAccountId;

  // Try without ctId first (simpler endpoint), fall back to the ctId-scoped one
  let deals: CTraderRawDeal[] = [];
  let lastError: Error | null = null;

  const endpoints = [
    `${CTRADER_BASE}/account/${accountId}/history/deals?from=${fromMs}&to=${toMs}&limit=1000`,
    ...(account.ctid
      ? [`${CTRADER_BASE}/ct_id/${account.ctid}/accounts/${accountId}/history/deals?from=${fromMs}&to=${toMs}&limit=1000`]
      : []),
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { lastError = new Error(`${res.status} ${res.statusText}`); continue; }
      const json = await res.json();
      const raw: any[] = Array.isArray(json) ? json : (json.deals ?? json.data ?? []);
      deals = raw.filter((d: any) => d.closeTimestamp > 0 && d.netProfit !== undefined);
      lastError = null;
      break;
    } catch (e) {
      lastError = e as Error;
    }
  }

  if (lastError) throw new Error(`cTrader deals failed: ${lastError.message}`);

  return deals
    .sort((a, b) => a.closeTimestamp - b.closeTimestamp)
    .map((d) => ({
      id: String(d.dealId),
      pair: d.symbolName.replace(/[^A-Z0-9]/g, ''),
      side: d.tradeSide === 'BUY' ? 'buy' : 'sell',
      pnl: d.netProfit,
      pnl_percent: null,
      trade_time: new Date(d.closeTimestamp).toISOString(),
      open_time: d.openTimestamp ? new Date(d.openTimestamp).toISOString() : null,
      account_type: 'live',
    }));
}
