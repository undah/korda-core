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

// In dev: Vite proxies /api/ctrader → https://openapi.ctrader.com/apps
// In prod: Cloudflare Pages Function at functions/api/ctrader/[[path]].js does the same
const CTRADER_BASE = '/api/ctrader';

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

export type CTraderTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms timestamp
  ctid?: number;    // cTrader ID — returned by token endpoint, used for accounts URL
};

export function buildCtraderAuthUrl(redirectUri: string): string {
  const clientId = import.meta.env.VITE_CTRADER_CLIENT_ID ?? '';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'trading',
  });
  return `https://openapi.ctrader.com/apps/auth?${params}`;
}

function tryDecodeCtid(token: string): number | null {
  // cTrader access tokens are JWTs — decode the payload to extract ctid
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const raw = payload.ctid ?? payload.cTid ?? payload.userId ?? payload.sub;
    const n = Number(raw);
    return raw != null && !isNaN(n) ? n : null;
  } catch {
    return null;
  }
}

async function postToken(body: Record<string, string>): Promise<CTraderTokens> {
  const res = await fetch(`${CTRADER_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`cTrader token request failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  const accessToken = json.accessToken ?? json.access_token ?? json.token;
  const refreshToken = json.refreshToken ?? json.refresh_token ?? '';
  const expiresIn = json.expiresIn ?? json.expires_in ?? 3600;
  if (!accessToken) throw new Error(`cTrader token: unexpected response — ${JSON.stringify(json)}`);
  // ctid may come from the response body or from the JWT payload
  const ctid: number | undefined =
    json.ctid ?? json.cTid ?? tryDecodeCtid(accessToken) ?? undefined;
  return { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000, ctid };
}

export async function exchangeAuthCode(code: string, redirectUri: string): Promise<CTraderTokens> {
  return postToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: import.meta.env.VITE_CTRADER_CLIENT_ID ?? '',
    client_secret: import.meta.env.VITE_CTRADER_CLIENT_SECRET ?? '',
  });
}

export async function refreshCtraderToken(refreshToken: string): Promise<CTraderTokens> {
  return postToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: import.meta.env.VITE_CTRADER_CLIENT_ID ?? '',
    client_secret: import.meta.env.VITE_CTRADER_CLIENT_SECRET ?? '',
  });
}

// ── WebSocket bridge (via Cloudflare Pages Function) ─────────────────────────

function bridgeBody(extra: Record<string, unknown>) {
  return JSON.stringify({
    clientId: import.meta.env.VITE_CTRADER_CLIENT_ID ?? '',
    clientSecret: import.meta.env.VITE_CTRADER_CLIENT_SECRET ?? '',
    ...extra,
  });
}

export async function fetchCTraderAccountsViaWebSocket(token: string): Promise<CTraderAccount[]> {
  const res = await fetch('/api/ctrader/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bridgeBody({ token }),
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch {
    throw new Error(`Bridge not reachable (status ${res.status}). Are you testing on Cloudflare Pages, not localhost? Body: ${text.slice(0, 120)}`);
  }
  if (!res.ok || json.error) throw new Error(json.error ?? `accounts bridge: ${res.status}`);
  return (json.accounts ?? []) as CTraderAccount[];
}

export async function fetchDealsViaWebSocket(
  token: string,
  ctidTraderAccountId: number,
  fromMs: number,
  toMs: number
): Promise<TradeEntry[]> {
  const res = await fetch('/api/ctrader/deals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bridgeBody({ token, ctidTraderAccountId, from: fromMs, to: toMs }),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? `deals bridge: ${res.status}`);
  return ((json.deals ?? []) as TradeEntry[]).sort((a, b) => a.trade_time.localeCompare(b.trade_time));
}

export async function fetchCTraderAccounts(token: string, ctid?: number): Promise<CTraderAccount[]> {
  const headers = { Authorization: `Bearer ${token}` };

  // Step 1: resolve ctid — from stored value, JWT decode, or profile endpoint
  let resolvedCtid: number | undefined = ctid ?? tryDecodeCtid(token) ?? undefined;
  let profileDebug = '';

  if (!resolvedCtid) {
    for (const profilePath of ['/trading/profile', '/profile', '/me']) {
      const pr = await fetch(`${CTRADER_BASE}${profilePath}`, { headers });
      const body = await pr.text().catch(() => '');
      profileDebug += `${profilePath}→${pr.status}: ${body.slice(0, 120)} | `;
      if (pr.ok) {
        try {
          const p = JSON.parse(body);
          resolvedCtid = p.ctid ?? p.cTid ?? p.userId ?? p.id ?? undefined;
        } catch {}
        if (resolvedCtid) break;
      }
    }
  }

  // Step 2: try accounts endpoints
  const candidates = [
    ...(resolvedCtid ? [`${CTRADER_BASE}/trading/ctid/${resolvedCtid}/accounts`] : []),
    `${CTRADER_BASE}/trading/accounts`,
    `${CTRADER_BASE}/accounts`,
  ];

  let lastDetail = '';
  for (const endpoint of candidates) {
    const res = await fetch(endpoint, { headers });
    if (res.ok) {
      const json = await res.json();
      const list: any[] = Array.isArray(json) ? json : (json.accounts ?? json.data ?? []);
      return list.map((a: any) => ({
        ctidTraderAccountId: a.ctidTraderAccountId ?? a.accountId ?? a.id,
        ctid: a.ctid ?? a.ctId,
        isLive: a.isLive ?? a.live,
        brokerTitle: a.brokerTitle ?? a.broker,
        traderLogin: a.traderLogin ?? a.login,
      }));
    }
    const body = await res.text().catch(() => '');
    lastDetail = `${endpoint}→${res.status}: ${body.slice(0, 120)}`;
  }

  throw new Error(`accounts failed. ctid=${resolvedCtid ?? 'none'} | profile: ${profileDebug} | last: ${lastDetail}`);
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
