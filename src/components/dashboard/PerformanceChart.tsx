import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TradeRow = {
  id: string;
  pair?: string | null;
  side?: "buy" | "sell" | string | null;
  pnl?: number | string | null;
  created_at?: string | null;
  entry_time?: string | null;
  exit_time?: string | null;
  date?: string | null;
};

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeDateMs(v: any) {
  if (!v) return NaN;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : NaN;
}

function pickTradeTime(t: TradeRow) {
  return (
    t.exit_time ||
    t.entry_time ||
    t.created_at ||
    t.date ||
    null
  );
}

function formatShortDate(d: Date) {
  // e.g. "Jan 24"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function PerformanceChart({
  trades,
  startingBalance = 0,
  title = "Account Performance",
  subtitle = "PnL over time",
}: {
  trades: TradeRow[];
  startingBalance?: number;
  title?: string;
  subtitle?: string;
}) {
  const chartData = useMemo(() => {
    if (!trades?.length) return [];

    const sorted = [...trades].sort((a, b) => {
      const ta = safeDateMs(pickTradeTime(a));
      const tb = safeDateMs(pickTradeTime(b));
      return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
    });

    let running = safeNumber(startingBalance, 0);

    return sorted.map((t) => {
      running += safeNumber(t.pnl, 0);
      const ms = safeDateMs(pickTradeTime(t));
      const dt = Number.isFinite(ms) ? new Date(ms) : new Date();
      return {
        date: formatShortDate(dt),
        balance: Math.round(running * 100) / 100,
      };
    });
  }, [trades, startingBalance]);

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="mb-6">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="h-[300px]">
        {!chartData.length ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No trade data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(173 80% 40%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(173 80% 40%)" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
              <XAxis
                dataKey="date"
                stroke="hsl(215 20% 55%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(215 20% 55%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222 47% 10%)",
                  border: "1px solid hsl(222 30% 18%)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 24px hsl(222 47% 4% / 0.5)",
                }}
                labelStyle={{ color: "hsl(210 40% 98%)" }}
                formatter={(value: number) => [`$${Number(value).toLocaleString()}`, "Balance"]}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="hsl(173 80% 40%)"
                strokeWidth={2}
                fill="url(#balanceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
