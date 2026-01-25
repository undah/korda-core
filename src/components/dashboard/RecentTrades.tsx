import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useMemo } from "react";

export type TradeRow = {
  id: string;
  pair: string;
  side?: "buy" | "sell" | null; // your DB seems to use "side"
  type?: "buy" | "sell" | null; // fallback if you ever use "type"
  entry?: number | null;
  exit?: number | null;
  pnl: number | null;
  pnl_percent?: number | null;
  pnlPercent?: number | null; // fallback
  entry_time?: string | null;
  exit_time?: string | null;
  created_at?: string | null;
};

type Props = {
  trades: TradeRow[];
  limit?: number;
};

function formatDateLabel(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtPrice(n?: number | null) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "-";
  const num = Number(n);
  // 4 decimals for FX, but keeps clean for others too
  return num.toFixed(num < 10 ? 4 : 2);
}

export function RecentTrades({ trades, limit = 5 }: Props) {
  const rows = useMemo(() => {
    const sorted = [...(trades ?? [])].sort((a, b) => {
      const ta = Date.parse(a.exit_time ?? a.entry_time ?? a.created_at ?? "");
      const tb = Date.parse(b.exit_time ?? b.entry_time ?? b.created_at ?? "");
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    return sorted.slice(0, limit);
  }, [trades, limit]);

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-border">
        <h3 className="font-semibold">Recent Trades</h3>
        <p className="text-sm text-muted-foreground">Your latest trading activity</p>
      </div>

      {rows.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">No trades yet.</div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((trade) => {
            const side = (trade.side ?? trade.type ?? "buy") as "buy" | "sell";
            const pnl = Number(trade.pnl ?? 0);
            const pnlPercent =
              trade.pnl_percent ?? trade.pnlPercent ?? null;

            const when = formatDateLabel(trade.exit_time ?? trade.entry_time ?? trade.created_at);

            return (
              <div
                key={trade.id}
                className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        side === "buy" ? "bg-success/10" : "bg-destructive/10"
                      )}
                    >
                      {side === "buy" ? (
                        <ArrowUpRight className="w-5 h-5 text-success" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-destructive" />
                      )}
                    </div>

                    <div>
                      <p className="font-medium">{trade.pair}</p>

                      <p className="text-sm text-muted-foreground">
                        {side.toUpperCase()} • {fmtPrice(trade.entry)} → {fmtPrice(trade.exit)}
                        {when ? ` • ${when}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={cn(
                        "font-mono font-medium",
                        pnl >= 0 ? "text-success" : "text-destructive"
                      )}
                    >
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toFixed(2)}
                    </p>

                    {pnlPercent !== null && pnlPercent !== undefined ? (
                      <p
                        className={cn(
                          "text-sm font-mono",
                          pnl >= 0 ? "text-success/70" : "text-destructive/70"
                        )}
                      >
                        {Number(pnlPercent) >= 0 ? "+" : ""}
                        {Number(pnlPercent).toFixed(1)}%
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground font-mono">—</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
