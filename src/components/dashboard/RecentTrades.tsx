import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface Trade {
  id: string;
  pair: string;
  type: "buy" | "sell";
  entry: number;
  exit: number;
  pnl: number;
  pnlPercent: number;
  date: string;
}

const mockTrades: Trade[] = [
  { id: "1", pair: "EUR/USD", type: "buy", entry: 1.0850, exit: 1.0892, pnl: 420, pnlPercent: 2.1, date: "Today, 14:32" },
  { id: "2", pair: "GBP/JPY", type: "sell", entry: 188.450, exit: 187.920, pnl: 530, pnlPercent: 2.8, date: "Today, 11:15" },
  { id: "3", pair: "USD/CAD", type: "buy", entry: 1.3620, exit: 1.3580, pnl: -280, pnlPercent: -1.4, date: "Yesterday" },
  { id: "4", pair: "AUD/USD", type: "sell", entry: 0.6540, exit: 0.6495, pnl: 450, pnlPercent: 2.3, date: "Yesterday" },
  { id: "5", pair: "EUR/GBP", type: "buy", entry: 0.8580, exit: 0.8612, pnl: 320, pnlPercent: 1.6, date: "Jan 18" },
];

export function RecentTrades() {
  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-border">
        <h3 className="font-semibold">Recent Trades</h3>
        <p className="text-sm text-muted-foreground">Your latest trading activity</p>
      </div>
      <div className="divide-y divide-border">
        {mockTrades.map((trade) => (
          <div key={trade.id} className="p-4 hover:bg-accent/50 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  trade.type === "buy" ? "bg-success/10" : "bg-destructive/10"
                )}>
                  {trade.type === "buy" ? (
                    <ArrowUpRight className="w-5 h-5 text-success" />
                  ) : (
                    <ArrowDownRight className="w-5 h-5 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{trade.pair}</p>
                  <p className="text-sm text-muted-foreground">
                    {trade.type.toUpperCase()} • {trade.entry.toFixed(4)} → {trade.exit.toFixed(4)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "font-mono font-medium",
                  trade.pnl >= 0 ? "text-success" : "text-destructive"
                )}>
                  {trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(2)}
                </p>
                <p className={cn(
                  "text-sm font-mono",
                  trade.pnl >= 0 ? "text-success/70" : "text-destructive/70"
                )}>
                  {trade.pnlPercent >= 0 ? "+" : ""}{trade.pnlPercent.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
