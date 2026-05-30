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
  if (res.status === 429) throw new Error('cTrader rate limit hit — wait a few minutes then try again');
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

// ── Direct browser WebSocket to cTrader Open API (wss://live.ctraderapi.com:5035) ──

const CT_WS = 'wss://live.ctraderapi.com:5035';

function encVarInt(n: bigint): Uint8Array {
  const b: number[] = [];
  do { let byte = Number(n & 0x7fn); n >>= 7n; if (n > 0n) byte |= 0x80; b.push(byte); } while (n > 0n);
  return new Uint8Array(b);
}
function ctConcat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((s, a) => s + a.length, 0);
  const r = new Uint8Array(len); let off = 0;
  for (const a of arrs) { r.set(a, off); off += a.length; }
  return r;
}
const cvf = (f: number, n: number | bigint): Uint8Array => ctConcat(encVarInt(BigInt(f << 3) | 0n), encVarInt(BigInt(n)));
const csf = (f: number, s: string): Uint8Array => { const b = new TextEncoder().encode(s); return ctConcat(encVarInt(BigInt(f << 3) | 2n), encVarInt(BigInt(b.length)), b); };
const cbf = (f: number, b: Uint8Array): Uint8Array => ctConcat(encVarInt(BigInt(f << 3) | 2n), encVarInt(BigInt(b.length)), b);

function ctFrame(pt: number, payload: Uint8Array): Uint8Array {
  const msg = ctConcat(cvf(1, pt), cbf(2, payload));
  const out = new Uint8Array(4 + msg.length);
  new DataView(out.buffer).setUint32(0, msg.length, false);
  out.set(msg, 4);
  return out;
}
function ctReadVarint(b: Uint8Array, i: number): [bigint, number] {
  let v = 0n, s = 0n;
  while (i < b.length) { const x = b[i++]; v |= BigInt(x & 0x7f) << s; s += 7n; if (!(x & 0x80)) break; }
  return [v, i];
}
function ctDecode(b: Uint8Array): Record<number, any> {
  const f: Record<number, any> = {}; let i = 0;
  while (i < b.length) {
    let tag: bigint; [tag, i] = ctReadVarint(b, i);
    const fn = Number(tag >> 3n), wt = Number(tag & 7n);
    let v: any;
    if      (wt === 0) { [v, i] = ctReadVarint(b, i); }
    else if (wt === 2) { let l: bigint; [l, i] = ctReadVarint(b, i); v = b.slice(i, i + Number(l)); i += Number(l); }
    else if (wt === 1) { v = b.slice(i, i + 8); i += 8; }
    else if (wt === 5) { v = b.slice(i, i + 4); i += 4; }
    else break;
    if (fn in f) { if (!Array.isArray(f[fn])) f[fn] = [f[fn]]; f[fn].push(v); } else f[fn] = v;
  }
  return f;
}
const ctToArr  = (v: any): any[] => v == null ? [] : Array.isArray(v) ? v : [v];
const ctNum    = (v: any): number => v == null ? 0 : Number(typeof v === 'bigint' ? v : v);
const ctSigned = (v: any): bigint => { const n = typeof v === 'bigint' ? v : 0n; return n >= 9223372036854775808n ? n - 18446744073709551616n : n; };
const ctStr    = (v: any): string => v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v ?? '');

const ctMsgAppAuth     = (id: string, sec: string) => ctFrame(2100, ctConcat(csf(1, id), csf(2, sec)));
const ctMsgAccList     = (tok: string)             => ctFrame(2149, csf(1, tok));
const ctMsgAccAuth     = (aid: number, tok: string)=> ctFrame(2102, ctConcat(cvf(1, aid), csf(2, tok)));
const ctMsgSymbols     = (aid: number)             => ctFrame(2115, cvf(1, aid));
const ctMsgDeals       = (aid: number, f: number, t: number) =>
  ctFrame(2155, ctConcat(cvf(1, aid), cvf(3, BigInt(f)), cvf(4, BigInt(t)), cvf(5, 5000)));

function openCTSocket(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(CT_WS);
    ws.binaryType = 'arraybuffer';
    ws.onopen  = () => resolve(ws);
    ws.onerror = () => reject(new Error('WebSocket connection failed — check browser console'));
    setTimeout(() => reject(new Error('WebSocket open timed out after 10s')), 10_000);
  });
}

function ctParseMsg(evt: MessageEvent): { pt: number; payload: Uint8Array } {
  const raw = new Uint8Array(evt.data as ArrayBuffer);
  const msg = ctDecode(raw.slice(4));
  const pt  = ctNum(msg[1]);
  const payload = msg[2] instanceof Uint8Array ? msg[2] : new Uint8Array(0);
  return { pt, payload };
}

function ctCheckError(pt: number, payload: Uint8Array): void {
  if (pt === 50 || pt === 2142) {
    const e = ctDecode(payload);
    throw new Error(`cTrader error: ${ctStr(e[2] ?? e[1])}`);
  }
}

export async function fetchCTraderAccountsViaWebSocket(token: string): Promise<CTraderAccount[]> {
  const clientId     = import.meta.env.VITE_CTRADER_CLIENT_ID ?? '';
  const clientSecret = import.meta.env.VITE_CTRADER_CLIENT_SECRET ?? '';

  const ws = await openCTSocket();

  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (accounts?: CTraderAccount[], err?: Error) => {
      if (done) return; done = true;
      ws.close();
      if (err) reject(err); else resolve(accounts!);
    };
    const timer = setTimeout(() => finish(undefined, new Error('cTrader timeout after 20s')), 20_000);

    let state = 'app_auth';
    ws.send(ctMsgAppAuth(clientId, clientSecret).buffer as ArrayBuffer);

    ws.onmessage = (evt) => {
      try {
        const { pt, payload } = ctParseMsg(evt);
        ctCheckError(pt, payload);
        if (state === 'app_auth' && pt === 2101) {
          state = 'acc_list';
          ws.send(ctMsgAccList(token).buffer);
        } else if (state === 'acc_list' && pt === 2150) {
          clearTimeout(timer);
          const res = ctDecode(payload);
          const accounts = ctToArr(res[2]).map((b: Uint8Array) => {
            const a = ctDecode(b);
            return { ctidTraderAccountId: ctNum(a[1]), isLive: ctNum(a[2]) === 1, traderLogin: ctNum(a[3]) };
          });
          finish(accounts);
        }
      } catch (e: any) { clearTimeout(timer); finish(undefined, e); }
    };
    ws.onerror = () => { clearTimeout(timer); finish(undefined, new Error('WebSocket error during accounts fetch')); };
    ws.onclose = (e) => { clearTimeout(timer); if (!done) finish(undefined, new Error(`WebSocket closed (code ${e.code})`)); };
  });
}

export async function fetchDealsViaWebSocket(
  token: string,
  ctidTraderAccountId: number,
  fromMs: number,
  toMs: number
): Promise<TradeEntry[]> {
  const clientId     = import.meta.env.VITE_CTRADER_CLIENT_ID ?? '';
  const clientSecret = import.meta.env.VITE_CTRADER_CLIENT_SECRET ?? '';

  const ws = await openCTSocket();

  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (deals?: TradeEntry[], err?: Error) => {
      if (done) return; done = true;
      ws.close();
      if (err) reject(err); else resolve(deals!);
    };
    const timer = setTimeout(() => finish(undefined, new Error('cTrader timeout after 25s')), 25_000);

    let state = 'app_auth';
    const symMap: Record<number, string> = {};
    ws.send(ctMsgAppAuth(clientId, clientSecret).buffer as ArrayBuffer);

    ws.onmessage = (evt) => {
      try {
        const { pt, payload } = ctParseMsg(evt);
        ctCheckError(pt, payload);
        if (state === 'app_auth' && pt === 2101) {
          state = 'acc_auth';
          ws.send(ctMsgAccAuth(ctidTraderAccountId, token).buffer);
        } else if (state === 'acc_auth' && pt === 2103) {
          state = 'symbols';
          ws.send(ctMsgSymbols(ctidTraderAccountId).buffer);
        } else if (state === 'symbols' && pt === 2116) {
          const sr = ctDecode(payload);
          for (const sb of ctToArr(sr[2])) {
            const s = ctDecode(sb as Uint8Array);
            if (s[1] && s[2]) symMap[ctNum(s[1])] = ctStr(s[2]);
          }
          state = 'deals';
          ws.send(ctMsgDeals(ctidTraderAccountId, fromMs, toMs).buffer);
        } else if (state === 'deals' && pt === 2156) {
          clearTimeout(timer);
          const dr = ctDecode(payload);
          const deals = ctToArr(dr[2]).map((b: Uint8Array) => {
            const d = ctDecode(b);
            if (!d[10]) return null;
            const cp    = ctDecode(d[10]);
            const pnl   = Number(ctSigned(cp[2] ?? 0n) + ctSigned(cp[3] ?? 0n) + ctSigned(cp[4] ?? 0n)) / 100;
            const symId = ctNum(d[6] ?? 0n);
            const closeMs = ctNum(d[8] ?? d[7] ?? 0n);
            const openMs  = cp[14] != null ? ctNum(cp[14]) : null;
            return {
              id:           String(d[1] ?? '?'),
              pair:         (symMap[symId] ?? String(symId)).replace(/[^A-Z0-9]/gi, '').toUpperCase(),
              side:         ctNum(d[12]) === 2 ? 'sell' : 'buy',
              pnl,
              pnl_percent:  null,
              trade_time:   closeMs ? new Date(closeMs).toISOString() : new Date().toISOString(),
              open_time:    openMs  ? new Date(openMs).toISOString()  : null,
              account_type: 'live' as const,
            } as TradeEntry;
          }).filter(Boolean) as TradeEntry[];
          finish(deals.sort((a, b) => a.trade_time.localeCompare(b.trade_time)));
        }
      } catch (e: any) { clearTimeout(timer); finish(undefined, e); }
    };
    ws.onerror = () => { clearTimeout(timer); finish(undefined, new Error('WebSocket error during deals fetch')); };
    ws.onclose = (e) => { clearTimeout(timer); if (!done) finish(undefined, new Error(`WebSocket closed (code ${e.code})`)); };
  });
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
