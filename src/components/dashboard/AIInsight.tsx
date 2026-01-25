import { Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type Trade = {
  id: string;
  pair?: string | null;
  symbol?: string | null;
  type?: "buy" | "sell" | "BUY" | "SELL" | string;
  side?: "buy" | "sell" | "BUY" | "SELL" | string;
  pnl?: number | null;
  profit?: number | null;
  entry_time?: string | null;
  close_time?: string | null;
  date?: string | null;
};

function normPair(t: Trade) {
  const raw = (t.pair ?? t.symbol ?? "").toString().trim();
  return raw || "Unknown";
}

function normSide(t: Trade) {
  const s = (t.side ?? t.type ?? "").toString().toLowerCase();
  return s === "buy" || s === "sell" ? s : null;
}

function normPnl(t: Trade) {
  const v = t.pnl ?? t.profit ?? 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function winRate(trades: Trade[]) {
  const closed = trades.filter((t) => Number.isFinite(normPnl(t)));
  const wins = closed.filter((t) => normPnl(t) > 0).length;
  const total = closed.length;
  return { wins, total, wr: total ? (wins / total) * 100 : 0 };
}

function avgHoldMs(trades: Trade[]) {
  const ms: number[] = [];
  for (const t of trades) {
    const a = t.entry_time ?? t.date ?? null;
    const b = t.close_time ?? null;
    const ta = a ? Date.parse(a) : NaN;
    const tb = b ? Date.parse(b) : NaN;
    if (Number.isFinite(ta) && Number.isFinite(tb) && tb >= ta) ms.push(tb - ta);
  }
  if (!ms.length) return null;
  return ms.reduce((x, y) => x + y, 0) / ms.length;
}

function fmtPct(n: number) {
  return `${n.toFixed(0)}%`;
}

export function AIInsight({ trades = [] }: { trades: Trade[] }) {
  const navigate = useNavigate();

  // only use last ~40 trades for “recent”
  const recent = [...trades]
    .sort((a, b) => {
      const ta = Date.parse((a.entry_time ?? a.date ?? "") as string) || 0;
      const tb = Date.parse((b.entry_time ?? b.date ?? "") as string) || 0;
      return tb - ta;
    })
    .slice(0, 40);

  // group by pair
  const byPair = new Map<string, Trade[]>();
  for (const t of recent) {
    const p = normPair(t);
    byPair.set(p, [...(byPair.get(p) ?? []), t]);
  }

  // find "best" pair (min 5 trades)
  let bestPair: string | null = null;
  let bestWR = -1;
  for (const [pair, ts] of byPair.entries()) {
    if (ts.length < 5) continue;
    const { wr } = winRate(ts);
    if (wr > bestWR) {
      bestWR = wr;
      bestPair = pair;
    }
  }

  // find "worst" pair (min 5 trades)
  let worstPair: string | null = null;
  let worstWR = 999;
  for (const [pair, ts] of byPair.entries()) {
    if (ts.length < 5) continue;
    const { wr } = winRate(ts);
    if (wr < worstWR) {
      worstWR = wr;
      worstPair = pair;
    }
  }

  const overall = winRate(recent);
  const hold = avgHoldMs(recent);

  const insightText =
    recent.length < 5
      ? "Add a few more trades to unlock personalized insights (I need at least ~5 recent trades)."
      : bestPair
      ? `You're doing best on ${bestPair} recently (${fmtPct(bestWR)} win rate). ${
          worstPair && worstPair !== bestPair
            ? `Your weakest pair is ${worstPair} (${fmtPct(worstWR)} win rate).`
            : ""
        } ${
          hold
            ? `Avg hold time is about ${Math.round(hold / 60000)} min — consider keeping exits consistent with your plan.`
            : `Try to keep exits consistent with your plan (TP/SL + rules).`
        }`
      : `Recent win rate is ${fmtPct(overall.wr)} across ${overall.total} trades. Add more trades per pair (5+) for pair-specific insights.`;

  return (
    <div className="glass-card p-6 animate-fade-in gradient-border overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center animate-glow-pulse">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">AI Coach Insight</h3>
            <p className="text-sm text-muted-foreground">
              {recent.length ? `Based on your last ${recent.length} trades` : "No trades yet"}
            </p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm leading-relaxed">
              {bestPair ? (
                <>
                  I noticed you're performing well on{" "}
                  <span className="text-primary font-medium">{bestPair}</span>{" "}
                  trades with a <span className="text-primary font-medium">{fmtPct(bestWR)}</span>{" "}
                  win rate.{" "}
                  {worstPair && worstPair !== bestPair && (
                    <>
                      However, your{" "}
                      <span className="text-destructive font-medium">{worstPair}</span> trades
                      are underperforming (<span className="text-destructive font-medium">{fmtPct(worstWR)}</span>).
                      Consider tightening your entry criteria or reducing size on that pair until it stabilizes.
                    </>
                  )}
                  {!worstPair && (
                    <>Keep tagging your setups so I can get even more specific (setup → outcome patterns).</>
                  )}
                </>
              ) : (
                insightText
              )}
            </p>
          </div>

          {recent.length >= 5 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={cn(
                  "text-xs px-2 py-1 rounded-full border border-border bg-background/40"
                )}
              >
                Recent WR: {fmtPct(overall.wr)}
              </span>
              <span className="text-xs px-2 py-1 rounded-full border border-border bg-background/40">
                Trades: {overall.total}
              </span>
              {hold && (
                <span className="text-xs px-2 py-1 rounded-full border border-border bg-background/40">
                  Avg hold: {Math.round(hold / 60000)} min
                </span>
              )}
            </div>
          )}
        </div>

        <Button variant="glow" className="w-full" onClick={() => navigate("/coach")}>
          <Bot className="w-4 h-4" />
          Chat with AI Coach
        </Button>
      </div>
    </div>
  );
}
