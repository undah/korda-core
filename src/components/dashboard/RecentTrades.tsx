import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatPnl } from "@/lib/format";
import type { ProfileSettings } from "@/hooks/useProfileSettings";

type TradeRow = {
  id: string;
  pair?: string | null;
  side?: "buy" | "sell" | string | null;
  entry?: number | string | null;
  exit?: number | string | null;
  pnl?: number | string | null;
  pnl_percent?: number | string | null;
  created_at?: string | null;
  entry_time?: string | null;
  exit_time?: string | null;
  date?: string | null;
};

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeDateLabel(t: TradeRow, locale = "en-US") {
  const raw = t.exit_time || t.entry_time || t.created_at || t.date;
  if (!raw) return "";
  const ms = Date.parse(String(raw));
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleString(locale);
}

/** normalize settings coming from DB */
function safeCurrency(v: any): "USD" | "EUR" {
  const s = String(v || "USD").toUpperCase();
  return s === "EUR" ? "EUR" : "USD";
}

export function RecentTrades({
  trades,
  settings,
}: {
  trades: TradeRow[];
  settings: ProfileSettings;
}) {
  const locale = settings?.locale || "en-US";
  const currency = safeCurrency(settings?.currency);

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-border">
        <h3 className="font-semibold">Recent Trades</h3>
        <p className="text-sm text-muted-foreground">
          Your latest trading activity
        </p>
      </div>

      <div className="divide-y divide-border">
        {!trades?.length ? (
          <div className="p-6 text-sm text-muted-foreground">
            No trades yet.
          </div>
        ) : (
          trades.map((t) => {
            const side = (t.side || "buy").toString().toLowerCase();
            const isBuy = side === "buy";

            const pnl = safeNumber(t.pnl, 0);
            const pnlPct = safeNumber(t.pnl_percent, 0);

            const entry = safeNumber(t.entry, NaN);
            const exit = safeNumber(t.exit, NaN);

            const pnlText = formatPnl(pnl, pnlPct, {
              currency,
              locale,
              format: "money", // 🔒 force money only in RecentTrades
            });

            return (
              <div
                key={t.id}
                className="p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        isBuy ? "bg-success/10" : "bg-destructive/10"
                      )}
                    >
                      {isBuy ? (
                        <ArrowUpRight className="w-5 h-5 text-success" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-destructive" />
                      )}
                    </div>

                    <div>
                      <p className="font-medium">{t.pair || "-"}</p>
                      <p className="text-sm text-muted-foreground">
                        {side.toUpperCase()}
                        {Number.isFinite(entry) &&
                        Number.isFinite(exit)
                          ? ` • ${entry} → ${exit}`
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {safeDateLabel(t, locale)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={cn(
                        "font-mono font-medium",
                        pnl >= 0
                          ? "text-success"
                          : "text-destructive"
                      )}
                    >
                      {pnlText}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
