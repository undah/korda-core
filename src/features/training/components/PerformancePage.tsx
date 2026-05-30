import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Activity, Award, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildCtraderAuthUrl, exchangeAuthCode, refreshCtraderToken,
  fetchCTraderAccounts, fetchDealsFromCTrader,
  type CTraderAccount, type TradeEntry, type CTraderTokens,
} from '@/features/trading/lib/tradesDataSource';

const TOKEN_KEY = 'ct_tokens';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT  = '#00C8FF';
const GREEN   = '#10b981';
const RED     = '#ef4444';
const YELLOW  = '#f59e0b';
const MUTED   = 'rgba(240,246,252,0.35)';
const DIM     = 'rgba(240,246,252,0.18)';
const CARD_BG = '#0D0D14';

type Range = '1W' | '1M' | '3M' | 'All';
const RANGES: Range[] = ['1W', '1M', '3M', 'All'];
const RANGE_DAYS: Record<Range, number | null> = { '1W': 7, '1M': 30, '3M': 90, 'All': null };

// ── Session classifier (uses open time where available) ───────────────────────

function detectSession(trade: TradeEntry): 'london' | 'new_york' | 'asia' {
  const ts = trade.open_time ?? trade.trade_time;
  const d = new Date(ts);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const totalMin = h * 60 + m;
  if (totalMin < 480) return 'asia';        // 00:00–08:00 UTC
  if (totalMin < 900) return 'london';      // 08:00–15:00 UTC
  if (totalMin < 1320) return 'new_york';   // 15:00–22:00 UTC
  return 'asia';
}

// ── Metric computation ────────────────────────────────────────────────────────

interface Metrics {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null;
  bestTrade: number;
  worstTrade: number;
  equityCurve: { date: string; pnl: number; cum: number }[];
  bySession: { session: string; total: number; wins: number; winRate: number; netPnl: number }[];
  byPair: { pair: string; total: number; wins: number; winRate: number; netPnl: number }[];
}

function computeMetrics(deals: TradeEntry[]): Metrics {
  if (!deals.length) {
    return {
      total: 0, wins: 0, losses: 0, winRate: 0, netPnl: 0,
      avgWin: 0, avgLoss: 0, profitFactor: null, bestTrade: 0, worstTrade: 0,
      equityCurve: [], bySession: [], byPair: [],
    };
  }

  const winners = deals.filter(d => d.pnl > 0);
  const losers  = deals.filter(d => d.pnl < 0);
  const grossWin  = winners.reduce((s, d) => s + d.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((s, d) => s + d.pnl, 0));

  let cum = 0;
  const equityCurve = deals.map(d => {
    cum += d.pnl;
    return { date: d.trade_time, pnl: d.pnl, cum: +cum.toFixed(2) };
  });

  // Session breakdown
  const sessionMap: Record<string, TradeEntry[]> = {};
  for (const d of deals) {
    const s = detectSession(d);
    (sessionMap[s] = sessionMap[s] ?? []).push(d);
  }
  const sessionLabels: Record<string, string> = {
    london: 'London', new_york: 'New York', asia: 'Asia',
  };
  const bySession = Object.entries(sessionMap).map(([key, trades]) => {
    const sw = trades.filter(t => t.pnl > 0);
    return {
      session: sessionLabels[key] ?? key,
      total: trades.length,
      wins: sw.length,
      winRate: +((sw.length / trades.length) * 100).toFixed(1),
      netPnl: +trades.reduce((s, t) => s + t.pnl, 0).toFixed(2),
    };
  }).sort((a, b) => b.netPnl - a.netPnl);

  // Pair breakdown
  const pairMap: Record<string, TradeEntry[]> = {};
  for (const d of deals) {
    (pairMap[d.pair] = pairMap[d.pair] ?? []).push(d);
  }
  const byPair = Object.entries(pairMap).map(([pair, trades]) => {
    const pw = trades.filter(t => t.pnl > 0);
    return {
      pair,
      total: trades.length,
      wins: pw.length,
      winRate: +((pw.length / trades.length) * 100).toFixed(1),
      netPnl: +trades.reduce((s, t) => s + t.pnl, 0).toFixed(2),
    };
  }).sort((a, b) => b.netPnl - a.netPnl);

  return {
    total: deals.length,
    wins: winners.length,
    losses: losers.length,
    winRate: +((winners.length / deals.length) * 100).toFixed(1),
    netPnl: +deals.reduce((s, d) => s + d.pnl, 0).toFixed(2),
    avgWin: winners.length ? +(grossWin / winners.length).toFixed(2) : 0,
    avgLoss: losers.length ? +(grossLoss / losers.length).toFixed(2) : 0,
    profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : null,
    bestTrade: deals.length ? +Math.max(...deals.map(d => d.pnl)).toFixed(2) : 0,
    worstTrade: deals.length ? +Math.min(...deals.map(d => d.pnl)).toFixed(2) : 0,
    equityCurve,
    bySession,
    byPair,
  };
}

// ── Small components ──────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color, icon: Icon,
}: {
  label: string; value: string; sub?: string; color?: string; icon?: any;
}) {
  return (
    <div style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.06)', borderTop: `2px solid ${color ?? ACCENT}40`, borderRadius: 10, padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
        {Icon && <Icon size={13} style={{ color: color ?? ACCENT, opacity: 0.7, flexShrink: 0 }} />}
        <p style={{ fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: MUTED, fontFamily: "'IBM Plex Mono',monospace" }}>{label}</p>
      </div>
      <p style={{ fontSize: '1.4rem', fontWeight: 700, color: color ?? ACCENT, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '0.68rem', color: DIM, marginTop: '0.35rem', fontFamily: "'IBM Plex Mono',monospace" }}>{sub}</p>}
    </div>
  );
}

function PnlBadge({ value }: { value: number }) {
  const color = value > 0 ? GREEN : value < 0 ? RED : MUTED;
  return (
    <span style={{ color, fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.82rem', fontWeight: 600 }}>
      {value > 0 ? '+' : ''}{value.toFixed(2)}
    </span>
  );
}

function WinBadge({ pct }: { pct: number }) {
  const color = pct >= 55 ? GREEN : pct >= 45 ? YELLOW : RED;
  return (
    <span style={{ color, fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.82rem' }}>{pct}%</span>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const color = d.pnl >= 0 ? GREEN : RED;
  return (
    <div style={{ background: '#0C0C18', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 10, padding: '0.6rem 0.9rem', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.72rem', pointerEvents: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
      <p style={{ color: MUTED, marginBottom: '0.3rem', fontSize: '0.64rem' }}>
        {d.date ? format(parseISO(d.date), 'EEE, MMM d yyyy HH:mm') : ''}
      </p>
      <p style={{ color: ACCENT, fontWeight: 600, fontSize: '0.85rem' }}>{d.cum >= 0 ? '+' : ''}{d.cum}</p>
      <p style={{ color, marginTop: '0.15rem' }}>trade: {d.pnl >= 0 ? '+' : ''}{d.pnl}</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type ConnState = 'idle' | 'connecting' | 'connected' | 'error';

function getRedirectUri() {
  return window.location.origin + window.location.pathname;
}

function loadStoredTokens(): CTraderTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveTokens(t: CTraderTokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}

export default function PerformancePage() {
  const [connState, setConnState] = useState<ConnState>('idle');
  const [connError, setConnError] = useState<string | null>(null);
  const [accounts, setAccounts]   = useState<CTraderAccount[]>([]);
  const [selectedAcc, setSelectedAcc] = useState<CTraderAccount | null>(null);
  const [token, setToken]         = useState<string | null>(null);
  const [deals, setDeals]         = useState<TradeEntry[]>([]);
  const [loading, setLoading]     = useState(false);
  const [range, setRange]         = useState<Range>('3M');

  const hasEnvCreds = !!(
    import.meta.env.VITE_CTRADER_CLIENT_ID &&
    import.meta.env.VITE_CTRADER_CLIENT_SECRET
  );

  const connectWithToken = useCallback(async (accessToken: string) => {
    setConnState('connecting');
    try {
      const accs = await fetchCTraderAccounts(accessToken);
      if (!accs.length) throw new Error('No trading accounts found for this app.');
      setToken(accessToken);
      setAccounts(accs);
      setConnState('connected');
      if (accs.length === 1) setSelectedAcc(accs[0]);
    } catch (e: any) {
      setConnState('error');
      setConnError(e?.message ?? 'Connection failed');
    }
  }, []);

  // On mount: handle OAuth callback code or restore stored tokens
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      // Clean the code from the URL immediately
      window.history.replaceState({}, '', window.location.pathname);
      setConnState('connecting');
      exchangeAuthCode(code, getRedirectUri())
        .then(tokens => { saveTokens(tokens); return connectWithToken(tokens.accessToken); })
        .catch(e => { setConnState('error'); setConnError(e?.message ?? 'Auth failed'); });
      return;
    }

    // Restore existing session
    const stored = loadStoredTokens();
    if (!stored) return;

    if (Date.now() < stored.expiresAt - 60_000) {
      connectWithToken(stored.accessToken);
    } else if (stored.refreshToken) {
      setConnState('connecting');
      refreshCtraderToken(stored.refreshToken)
        .then(tokens => { saveTokens(tokens); return connectWithToken(tokens.accessToken); })
        .catch(() => { localStorage.removeItem(TOKEN_KEY); setConnState('idle'); });
    }
  }, [connectWithToken]);

  const handleConnect = () => {
    window.location.href = buildCtraderAuthUrl(getRedirectUri());
  };

  const loadDeals = useCallback(async (acc: CTraderAccount, tok: string) => {
    setLoading(true);
    try {
      const now = Date.now();
      const fromMs = subDays(new Date(), 180).getTime(); // fetch 6 months, filter by range in UI
      const fetched = await fetchDealsFromCTrader(tok, acc, fromMs, now);
      setDeals(fetched);
      toast.success(`Loaded ${fetched.length} deals.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAccountSelect = (acc: CTraderAccount) => {
    setSelectedAcc(acc);
    if (token) loadDeals(acc, token);
  };

  const handleRefresh = () => {
    if (selectedAcc && token) loadDeals(selectedAcc, token);
  };

  // Filter by selected range
  const filteredDeals = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!days) return deals;
    const cutoff = subDays(new Date(), days).toISOString();
    return deals.filter(d => d.trade_time >= cutoff);
  }, [deals, range]);

  const metrics = useMemo(() => computeMetrics(filteredDeals), [filteredDeals]);

  const yMin = metrics.equityCurve.length
    ? Math.floor(Math.min(...metrics.equityCurve.map(d => d.cum)) - 10)
    : 0;
  const yMax = metrics.equityCurve.length
    ? Math.ceil(Math.max(...metrics.equityCurve.map(d => d.cum)) + 10)
    : 100;

  // ── Not connected yet ──────────────────────────────────────────────────────
  if (connState !== 'connected') {
    return (
      <div style={{ maxWidth: 540, margin: '4rem auto', textAlign: 'center' }}>
        <BarChart2 size={36} style={{ color: ACCENT, marginBottom: '1rem', opacity: 0.7 }} />
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f6fc', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          cTrader Performance
        </h1>
        <p style={{ fontSize: '0.85rem', color: MUTED, marginBottom: '2rem', lineHeight: 1.6 }}>
          Connect your cTrader account to see your live trading stats, equity curve, and session breakdowns.
        </p>

        {!hasEnvCreds && connState === 'idle' && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>
            <p style={{ fontSize: '0.78rem', color: '#fca5a5', fontWeight: 600, marginBottom: '0.4rem', fontFamily: "'IBM Plex Mono',monospace" }}>Missing credentials</p>
            <p style={{ fontSize: '0.75rem', color: MUTED, lineHeight: 1.7, fontFamily: "'IBM Plex Mono',monospace" }}>
              Add to your <code style={{ color: ACCENT }}>.env</code> file:<br />
              <code>VITE_CTRADER_CLIENT_ID=your_client_id</code><br />
              <code>VITE_CTRADER_CLIENT_SECRET=your_client_secret</code>
            </p>
          </div>
        )}

        {connState === 'error' && connError && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>
            <p style={{ fontSize: '0.78rem', color: '#fca5a5', fontWeight: 600, marginBottom: '0.25rem', fontFamily: "'IBM Plex Mono',monospace" }}>Connection error</p>
            <p style={{ fontSize: '0.75rem', color: MUTED, fontFamily: "'IBM Plex Mono',monospace" }}>{connError}</p>
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={connState === 'connecting' || !hasEnvCreds}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem 2rem',
            background: connState === 'connecting' || !hasEnvCreds
              ? 'rgba(0,200,255,0.08)'
              : `linear-gradient(135deg, ${ACCENT} 0%, #0090b3 100%)`,
            color: connState === 'connecting' || !hasEnvCreds ? 'rgba(0,200,255,0.4)' : '#0A0A0F',
            border: connState === 'connecting' || !hasEnvCreds ? `1px solid rgba(0,200,255,0.2)` : 'none',
            borderRadius: 10, fontWeight: 700, fontSize: '0.88rem',
            cursor: connState === 'connecting' || !hasEnvCreds ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {connState === 'connecting'
            ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Connecting…</>
            : 'Connect cTrader'}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Account picker (multiple accounts) ────────────────────────────────────
  if (connState === 'connected' && !selectedAcc) {
    return (
      <div style={{ maxWidth: 480, margin: '4rem auto' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f0f6fc', marginBottom: '0.4rem' }}>Select account</h2>
        <p style={{ fontSize: '0.82rem', color: MUTED, marginBottom: '1.5rem' }}>Multiple accounts found. Choose one to analyze.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {accounts.map(acc => (
            <button
              key={acc.ctidTraderAccountId}
              onClick={() => handleAccountSelect(acc)}
              style={{
                background: CARD_BG, border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '0.9rem 1.25rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.15s', textAlign: 'left',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${ACCENT}40`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f0f6fc' }}>
                  {acc.brokerTitle ?? `Account ${acc.ctidTraderAccountId}`}
                </p>
                {acc.traderLogin && (
                  <p style={{ fontSize: '0.72rem', color: MUTED, fontFamily: "'IBM Plex Mono',monospace", marginTop: '0.15rem' }}>
                    Login: {acc.traderLogin}
                  </p>
                )}
              </div>
              <span style={{ fontSize: '0.68rem', padding: '0.2rem 0.55rem', borderRadius: 20, background: acc.isLive ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: acc.isLive ? GREEN : YELLOW, border: `1px solid ${acc.isLive ? GREEN : YELLOW}30`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {acc.isLive ? 'Live' : 'Demo'}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const pnlColor = metrics.netPnl > 0 ? GREEN : metrics.netPnl < 0 ? RED : MUTED;

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.02em' }}>
            Performance
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: MUTED }}>
            {selectedAcc?.brokerTitle ?? `Account ${selectedAcc?.ctidTraderAccountId}`}
            {selectedAcc?.traderLogin ? ` · Login ${selectedAcc.traderLogin}` : ''}
            {' · '}{filteredDeals.length} trades
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Range selector */}
          <div style={{ display: 'flex', background: '#080810', border: '1px solid rgba(0,200,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.65rem',
                  letterSpacing: '0.06em', padding: '0.4rem 0.75rem',
                  background: range === r ? ACCENT : 'transparent',
                  color: range === r ? '#080810' : 'rgba(240,246,252,0.3)',
                  border: 'none', cursor: 'pointer', fontWeight: range === r ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 8, padding: '0.4rem 0.65rem', color: ACCENT, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
          >
            <RefreshCw size={14} style={loading ? { animation: 'spin 0.8s linear infinite' } : undefined} />
          </button>

          <button
            onClick={() => { localStorage.removeItem(TOKEN_KEY); setConnState('idle'); setSelectedAcc(null); setDeals([]); setToken(null); setAccounts([]); }}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '0.4rem 0.75rem', color: 'rgba(240,246,252,0.3)', cursor: 'pointer', fontSize: '0.68rem', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.05em', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(240,246,252,0.6)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(240,246,252,0.3)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
          >
            disconnect
          </button>
        </div>
      </div>

      {loading && !filteredDeals.length ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem', color: MUTED, fontSize: '0.82rem', fontFamily: "'IBM Plex Mono',monospace", gap: '0.5rem', alignItems: 'center' }}>
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite', color: ACCENT }} /> Loading deals…
        </div>
      ) : filteredDeals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 2rem', color: MUTED, fontSize: '0.85rem' }}>
          No trades in this range.{' '}
          <button onClick={() => setRange('All')} style={{ background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>View all</button>
        </div>
      ) : (
        <>
          {/* ── Stat cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <StatCard
              icon={Activity}
              label="Net P&L"
              value={`${metrics.netPnl >= 0 ? '+' : ''}${metrics.netPnl.toFixed(2)}`}
              sub={`${metrics.total} trades`}
              color={pnlColor}
            />
            <StatCard
              icon={TrendingUp}
              label="Win Rate"
              value={`${metrics.winRate}%`}
              sub={`${metrics.wins}W · ${metrics.losses}L`}
              color={metrics.winRate >= 55 ? GREEN : metrics.winRate >= 45 ? YELLOW : RED}
            />
            <StatCard
              icon={Award}
              label="Profit Factor"
              value={metrics.profitFactor != null ? metrics.profitFactor.toFixed(2) : '—'}
              sub="gross win / gross loss"
              color={metrics.profitFactor != null && metrics.profitFactor >= 1 ? GREEN : RED}
            />
            <StatCard
              icon={TrendingUp}
              label="Avg Win"
              value={`+${metrics.avgWin.toFixed(2)}`}
              color={GREEN}
            />
            <StatCard
              icon={TrendingDown}
              label="Avg Loss"
              value={`-${metrics.avgLoss.toFixed(2)}`}
              color={RED}
            />
            <StatCard
              icon={Activity}
              label="Best Trade"
              value={`+${metrics.bestTrade.toFixed(2)}`}
              color={GREEN}
            />
          </div>

          {/* ── Equity curve ── */}
          <div style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.06)', borderTop: `2px solid ${pnlColor}40`, borderRadius: 10, padding: '1.25rem 1.5rem', marginBottom: '0.75rem' }}>
            <p style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTED, marginBottom: '1rem', fontFamily: "'IBM Plex Mono',monospace" }}>
              Equity Curve
            </p>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={metrics.equityCurve} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={pnlColor} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={pnlColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={d => { try { return format(parseISO(d), 'MMM d'); } catch { return ''; } }}
                    tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: DIM }}
                    axisLine={false} tickLine={false} interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[yMin, yMax]}
                    tickFormatter={v => `${v}`}
                    tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: DIM }}
                    axisLine={false} tickLine={false} tickCount={5} width={40}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0,200,255,0.12)', strokeWidth: 1 }} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                  <Area type="monotone" dataKey="cum" fill="url(#eqGrad)" stroke="none" dot={false} activeDot={false} />
                  <Line type="monotone" dataKey="cum" stroke={pnlColor} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: pnlColor, strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Session + Pair breakdowns ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

            {/* Session table */}
            <div style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTED, fontFamily: "'IBM Plex Mono',monospace" }}>By Session</p>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Session', 'Trades', 'Win%', 'Net P&L'].map(h => (
                      <th key={h} style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.62rem', fontWeight: 600, color: DIM, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.bySession.map(s => (
                    <tr key={s.session} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '0.65rem 1rem', fontSize: '0.8rem', color: '#f0f6fc', fontWeight: 500 }}>{s.session}</td>
                      <td style={{ padding: '0.65rem 1rem', fontSize: '0.78rem', color: MUTED, fontFamily: "'IBM Plex Mono',monospace" }}>{s.total}</td>
                      <td style={{ padding: '0.65rem 1rem' }}><WinBadge pct={s.winRate} /></td>
                      <td style={{ padding: '0.65rem 1rem' }}><PnlBadge value={s.netPnl} /></td>
                    </tr>
                  ))}
                  {metrics.bySession.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: DIM, fontSize: '0.78rem' }}>No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pair table */}
            <div style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTED, fontFamily: "'IBM Plex Mono',monospace" }}>By Instrument</p>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: CARD_BG, zIndex: 1 }}>
                    <tr>
                      {['Pair', 'Trades', 'Win%', 'Net P&L'].map(h => (
                        <th key={h} style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.62rem', fontWeight: 600, color: DIM, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.byPair.map(p => (
                      <tr key={p.pair} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '0.65rem 1rem', fontSize: '0.8rem', color: ACCENT, fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace" }}>{p.pair}</td>
                        <td style={{ padding: '0.65rem 1rem', fontSize: '0.78rem', color: MUTED, fontFamily: "'IBM Plex Mono',monospace" }}>{p.total}</td>
                        <td style={{ padding: '0.65rem 1rem' }}><WinBadge pct={p.winRate} /></td>
                        <td style={{ padding: '0.65rem 1rem' }}><PnlBadge value={p.netPnl} /></td>
                      </tr>
                    ))}
                    {metrics.byPair.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: DIM, fontSize: '0.78rem' }}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
