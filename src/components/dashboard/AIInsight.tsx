import { useMemo } from "react";
import { Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type TradeRow = {
  id: string;
  pair?: string | null;
  pnl?: number | string | null;
};

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function AIInsight({ trades }: { trades: TradeRow[] }) {
  const navigate = useNavigate();

  const insight = useMemo(() => {
    const list = trades ?? [];
    if (list.length < 5) {
      return {
        title: "AI Coach Insight",
        subtitle: "No trades yet",
        body: "Add a few more trades to unlock personalized insights (I need at least ~5 recent trades).",
      };
    }

    // win-rate per pair
    const byPair = new Map<string, { wins: number; losses: number; total: number }>();
    for (const t of list) {
      const pair = (t.pair || "Unknown").toUpperCase();
      const pnl = safeNumber(t.pnl, 0);
      const rec = byPair.get(pair) || { wins: 0, losses: 0, total: 0 };
      rec.total += 1;
      if (pnl > 0) rec.wins += 1;
      else if (pnl < 0) rec.losses += 1;
      byPair.set(pair, rec);
    }

    const pairs = [...byPair.entries()].filter(([, v]) => v.total >= 3);
    pairs.sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total));

    const best = pairs[0];
    const worst = pairs[pairs.length - 1];

    const bestText = best
      ? `${best[0]} with a ${(100 * best[1].wins / best[1].total).toFixed(0)}% win rate`
      : "your recent trades";
    const worstText = worst
      ? `${worst[0]} (win rate ${(100 * worst[1].wins / worst[1].total).toFixed(0)}%)`
      : "a pair with lower consistency";

    return {
      title: "AI Coach Insight",
      subtitle: "Based on your recent trades",
      body: `You're performing best on ${bestText}. Your weakest area is ${worstText}. Consider reducing size or tightening your rules on that pair until it stabilizes.`,
    };
  }, [trades]);

  return (
    <div className="glass-card p-6 animate-fade-in gradient-border overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center animate-glow-pulse">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{insight.title}</h3>
            <p className="text-sm text-muted-foreground">{insight.subtitle}</p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm leading-relaxed">{insight.body}</p>
          </div>
        </div>

        <Button variant="glow" className="w-full" onClick={() => navigate("/coach")}>
          <Bot className="w-4 h-4" />
          Chat with AI Coach
        </Button>
      </div>
    </div>
  );
}
