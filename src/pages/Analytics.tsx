import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { AlertTriangle, Calculator, Info, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useProfileSettings } from "@/hooks/useProfileSettings";
import { formatCurrency } from "@/lib/format";

// ✅ only live/backtest
type AccountView = "live" | "backtest";

type TradeRow = {
  id: string;
  user_id?: string;
  pair: string | null;
  pnl: number | string | null;
  pnl_percent: number | string | null;
  account_type: "live" | "backtest" | null;
  trade_time: string | null;
  created_at: string | null;
};

type DailyPoint = { date: string; pnl: number };
type WeeklyPoint = { day: string; pnl: number };
type PairPoint = { name: string; value: number; pnl: number };
type HourPoint = { hour: string; winRate: number };

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isoFromTrade(t: TradeRow) {
  return (t.trade_time ?? t.created_at ?? null) as string | null;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function sameDayKey(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function labelForDay(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getWeekStartMonday(now = new Date()) {
  const d = startOfDay(now);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  return addDays(d, -diff);
}

// ✅ closed = has pnl OR pnl_percent (planned trades usually have both null)
function isClosedTrade(t: TradeRow) {
  const hasPnl = t.pnl !== null && t.pnl !== undefined && Number.isFinite(Number(t.pnl));
  const hasPct =
    t.pnl_percent !== null &&
    t.pnl_percent !== undefined &&
    Number.isFinite(Number(t.pnl_percent));

  return hasPnl || hasPct;
}

function calcEquityAndDrawdown(trades: (TradeRow & { _iso: string })[]) {
  const sorted = [...trades].sort((a, b) => Date.parse(a._iso) - Date.parse(b._iso));

  let equity = 100;
  let peak = 100;
  let ddSum = 0;
  let ddCount = 0;
  let maxDd = 0;

  const curve: { date: string; equity: number; drawdown: number }[] = [];

  for (const t of sorted) {
    const pct = safeNum(t.pnl_percent, NaN);
    const pnlAbs = safeNum(t.pnl, NaN);

    if (Number.isFinite(pct)) equity = equity * (1 + pct / 100);
    else if (Number.isFinite(pnlAbs)) equity = equity + pnlAbs / 100;

    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((equity - peak) / peak) * 100 : 0; // negative
    maxDd = Math.min(maxDd, dd);

    ddSum += Math.abs(dd);
    ddCount += 1;

    curve.push({
      date: new Date(t._iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      equity,
      drawdown: dd,
    });
  }

  return {
    curve,
    avgDrawdownPct: ddCount ? ddSum / ddCount : 0,
    maxDrawdownPct: Math.abs(maxDd),
  };
}

function RiskStatCard({
  title,
  value,
  subtitle,
  icon,
  trend = "neutral",
  tooltip,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: "positive" | "negative" | "neutral";
  tooltip?: string;
}) {
  return (
    <div className="glass-card p-5 animate-fade-in group relative">
      <div className="flex items-start justify-between mb-3">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            trend === "positive" && "bg-success/10",
            trend === "negative" && "bg-destructive/10",
            trend === "neutral" && "bg-primary/10"
          )}
        >
          {icon}
        </div>

        {tooltip && (
          <div className="relative">
            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
            <div className="absolute right-0 top-6 w-56 p-2 bg-popover border border-border rounded-lg text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {tooltip}
            </div>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-1">{title}</p>
      <p
        className={cn(
          "text-2xl font-mono font-bold",
          trend === "positive" && "text-success",
          trend === "negative" && "text-destructive",
          trend === "neutral" && "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

export default function Analytics() {
  const { user } = useAuth();

  // ✅ default to live (no combined)
  const [view, setView] = useState<AccountView>("live");

  const [rows, setRows] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const { settings, loadingSettings } = useProfileSettings();
  const currency = (String(settings?.currency || "USD").toUpperCase() === "EUR" ? "EUR" : "USD") as
    | "USD"
    | "EUR";
  const locale = settings?.locale || "en-US";
  const money = (v: number) => formatCurrency(v, currency, locale);

  useEffect(() => {
    if (!user) return;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("trades")
        .select("id, user_id, pair, pnl, pnl_percent, account_type, trade_time, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Fetch trades for analytics error:", error);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as TradeRow[]);
      setLoading(false);
    })();
  }, [user]);

  const trades = useMemo(() => {
    // ✅ only show the selected bucket
    const filteredByView = rows.filter((t) => (t.account_type ?? "live") === view);

    return filteredByView
      .map((t) => ({ ...t, _iso: isoFromTrade(t) }))
      .filter((t: any) => !!t._iso)
      .filter((t: any) => isClosedTrade(t as TradeRow)) as (TradeRow & { _iso: string })[];
  }, [rows, view]);

  const dailyPnLData: DailyPoint[] = useMemo(() => {
    const now = new Date();
    const end = startOfDay(now);
    const start = addDays(end, -29);

    const map = new Map<string, number>();
    for (let i = 0; i < 30; i++) map.set(sameDayKey(addDays(start, i)), 0);

    for (const t of trades) {
      const key = sameDayKey(new Date(t._iso));
      if (!map.has(key)) continue;
      map.set(key, (map.get(key) ?? 0) + safeNum(t.pnl, 0));
    }

    return Array.from({ length: 30 }, (_, i) => {
      const d = addDays(start, i);
      return { date: labelForDay(d), pnl: map.get(sameDayKey(d)) ?? 0 };
    });
  }, [trades]);

  const weeklyPnL: WeeklyPoint[] = useMemo(() => {
    const start = getWeekStartMonday(new Date());
    const map = new Map<number, number>();
    for (let i = 0; i < 7; i++) map.set(i, 0);

    for (const t of trades) {
      const d = new Date(t._iso);
      const idx = (d.getDay() + 6) % 7; // Mon=0..Sun=6
      if (getWeekStartMonday(d).getTime() !== start.getTime()) continue;
      map.set(idx, (map.get(idx) ?? 0) + safeNum(t.pnl, 0));
    }

    return [
      { day: "Mon", pnl: map.get(0) ?? 0 },
      { day: "Tue", pnl: map.get(1) ?? 0 },
      { day: "Wed", pnl: map.get(2) ?? 0 },
      { day: "Thu", pnl: map.get(3) ?? 0 },
      { day: "Fri", pnl: map.get(4) ?? 0 },
      { day: "Sat", pnl: map.get(5) ?? 0 },
      { day: "Sun", pnl: map.get(6) ?? 0 },
    ];
  }, [trades]);

  const winLossData = useMemo(() => {
    const wins = trades.filter((t) => safeNum(t.pnl, 0) > 0).length;
    const losses = trades.filter((t) => safeNum(t.pnl, 0) < 0).length;

    return [
      { name: "Wins", value: wins, color: "hsl(160 84% 39%)" },
      { name: "Losses", value: losses, color: "hsl(0 84% 60%)" },
    ];
  }, [trades]);

  const winRate = useMemo(() => {
    const total = trades.length;
    if (!total) return 0;
    const wins = trades.filter((t) => safeNum(t.pnl, 0) > 0).length;
    return wins / total;
  }, [trades]);

  const pairPerformance = useMemo<PairPoint[]>(() => {
    const map = new Map<string, { pnl: number; abs: number }>();

    for (const t of trades) {
      const p = (t.pair ?? "Unknown").toUpperCase();
      const pnl = safeNum(t.pnl, 0);
      const prev = map.get(p) ?? { pnl: 0, abs: 0 };
      prev.pnl += pnl;
      prev.abs += Math.abs(pnl);
      map.set(p, prev);
    }

    const arr = [...map.entries()].map(([name, v]) => ({ name, pnl: v.pnl, abs: v.abs }));
    arr.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

    const top = arr.slice(0, 6);
    const totalAbs = top.reduce((acc, x) => acc + x.abs, 0) || 1;

    return top.map((x) => ({
      name: x.name,
      pnl: x.pnl,
      value: Math.round((x.abs / totalAbs) * 100),
    }));
  }, [trades]);

  const hourlyActivity = useMemo<HourPoint[]>(() => {
    const wins = new Array(24).fill(0);
    const total = new Array(24).fill(0);

    for (const t of trades) {
      const h = new Date(t._iso).getHours();
      total[h] += 1;
      if (safeNum(t.pnl, 0) > 0) wins[h] += 1;
    }

    return Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      winRate: total[h] ? (wins[h] / total[h]) * 100 : 0,
    }));
  }, [trades]);

  const riskMetrics = useMemo(() => {
    const total = trades.length;

    const winsArr = trades.filter((t) => safeNum(t.pnl, 0) > 0).map((t) => safeNum(t.pnl, 0));
    const lossArr = trades.filter((t) => safeNum(t.pnl, 0) < 0).map((t) => safeNum(t.pnl, 0));

    const wins = winsArr.length;
    const losses = lossArr.length;

    const avgWin = wins ? winsArr.reduce((a, b) => a + b, 0) / wins : 0;
    const avgLoss = losses ? Math.abs(lossArr.reduce((a, b) => a + b, 0) / losses) : 0;

    const wr = total ? wins / total : 0;
    const lr = 1 - wr;

    const expectedValue = wr * avgWin - lr * avgLoss;

    const grossProfit = winsArr.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(lossArr.reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const dd = calcEquityAndDrawdown(trades);

    let riskOfRuin = 25;
    if (expectedValue > 0 && avgLoss > 0) {
      const edge = expectedValue / avgLoss;
      riskOfRuin = Math.max(0.5, 12 / Math.max(0.2, edge * 10));
    }

    return {
      expectedValue,
      avgDrawdown: dd.avgDrawdownPct,
      maxDrawdown: dd.maxDrawdownPct,
      riskOfRuin,
      winRate: wr,
      avgWin,
      avgLoss,
      totalTrades: total,
      profitFactor,
      equityCurve: dd.curve,
    };
  }, [trades]);

  const viewLabel = view === "live" ? "Live" : "Backtest";

  if (loading || loadingSettings) {
    return (
      <MainLayout>
        <div className="glass-card p-6 text-sm text-muted-foreground mb-6">Loading analytics…</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Analytics</h1>
          <p className="text-muted-foreground">
            Deep dive into your trading performance • <span className="text-foreground">{viewLabel}</span>
          </p>
        </div>

        {/* ✅ only 2 tabs */}
        <Tabs value={view} onValueChange={(v) => setView(v as AccountView)}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="backtest">Backtest</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {trades.length === 0 && (
        <div className="glass-card p-6 text-sm text-muted-foreground mb-6">
          No closed trades found for this view.
        </div>
      )}

      {/* Daily P&L Chart */}
      <div className="glass-card p-6 animate-fade-in mb-6">
        <h3 className="font-semibold mb-1">Daily P&L</h3>
        <p className="text-sm text-muted-foreground mb-4">Profit and loss over the past 30 days</p>

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyPnLData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
              <XAxis dataKey="date" stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(215 20% 55%)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => money(Number(v))} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222 47% 10%)",
                  border: "1px solid hsl(222 30% 18%)",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [money(Number(value)), "P&L"]}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]} fill="hsl(173 80% 40%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly P&L */}
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="font-semibold mb-1">Weekly P&L</h3>
          <p className="text-sm text-muted-foreground mb-4">Daily profit and loss this week (Mon–Sun)</p>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyPnL}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
                <XAxis dataKey="day" stroke="hsl(215 20% 55%)" fontSize={12} />
                <YAxis stroke="hsl(215 20% 55%)" fontSize={12} tickFormatter={(v) => money(Number(v))} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222 47% 10%)",
                    border: "1px solid hsl(222 30% 18%)",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [money(Number(value)), "P&L"]}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]} fill="hsl(173 80% 40%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win/Loss Ratio */}
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="font-semibold mb-1">Win/Loss Ratio</h3>
          <p className="text-sm text-muted-foreground mb-4">Trade outcome distribution</p>

          <div className="h-[250px] flex items-center">
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie data={winLossData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  {winLossData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="flex-1 space-y-4">
              {winLossData.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }} />
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-2xl font-mono font-semibold">{item.value}</p>
                  </div>
                </div>
              ))}

              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-mono font-semibold text-success">
                  {(winRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pair Performance */}
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="font-semibold mb-1">Pair Performance</h3>
          <p className="text-sm text-muted-foreground mb-4">P&L breakdown by pair</p>

          <div className="space-y-4">
            {pairPerformance.map((pair) => (
              <div key={pair.name} className="flex items-center gap-4">
                <div className="w-24 font-medium">{pair.name}</div>
                <div className="flex-1">
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pair.value}%`,
                        backgroundColor: pair.pnl >= 0 ? "hsl(160 84% 39%)" : "hsl(0 84% 60%)",
                      }}
                    />
                  </div>
                </div>
                <div className={`font-mono text-sm w-28 text-right ${pair.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                  {pair.pnl >= 0 ? "+" : ""}
                  {money(Math.round(pair.pnl))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trading Hours */}
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="font-semibold mb-1">Trading Activity by Hour</h3>
          <p className="text-sm text-muted-foreground mb-4">Win rate by hour (local time)</p>

          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyActivity.slice(6, 22)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
                <XAxis dataKey="hour" stroke="hsl(215 20% 55%)" fontSize={10} />
                <YAxis stroke="hsl(215 20% 55%)" fontSize={12} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222 47% 10%)",
                    border: "1px solid hsl(222 30% 18%)",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${Number(value).toFixed(1)}%`, "Win rate"]}
                />
                <Line type="monotone" dataKey="winRate" stroke="hsl(173 80% 40%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Risk Metrics Section */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Risk Metrics
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <RiskStatCard
            title="Expected Value"
            value={money(riskMetrics.expectedValue)}
            subtitle="Per trade expectancy"
            icon={<Calculator className="w-5 h-5 text-primary" />}
            trend={riskMetrics.expectedValue >= 0 ? "positive" : "negative"}
            tooltip="EV = (WinRate × AvgWin) − (LossRate × AvgLoss)"
          />

          <RiskStatCard
            title="Average Drawdown"
            value={`${riskMetrics.avgDrawdown.toFixed(2)}%`}
            subtitle="Mean equity decline"
            icon={<TrendingDown className="w-5 h-5 text-warning" />}
            trend="neutral"
            tooltip="Approx. drawdown calculated from an equity curve built with pnl_percent (if available)."
          />

          <RiskStatCard
            title="Max Drawdown"
            value={`${riskMetrics.maxDrawdown.toFixed(2)}%`}
            subtitle="Largest equity drop"
            icon={<TrendingDown className="w-5 h-5 text-destructive" />}
            trend="negative"
            tooltip="Approx. max peak-to-trough decline."
          />

          <RiskStatCard
            title="Risk of Ruin"
            value={`${riskMetrics.riskOfRuin.toFixed(1)}%`}
            subtitle="Heuristic estimate"
            icon={<AlertTriangle className="w-5 h-5 text-destructive" />}
            trend={riskMetrics.riskOfRuin < 5 ? "positive" : "negative"}
            tooltip="Rough signal based on edge; becomes accurate if you track risk per trade + starting balance."
          />
        </div>
      </div>
    </MainLayout>
  );
}
