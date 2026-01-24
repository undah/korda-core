import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TestTube,
  BarChart3,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { AddTradeDialog } from "@/components/journal/AddTradeDialog";
import { Plus } from "lucide-react";
import { AddJournalEntryDialog } from "@/components/journal/AddJournalEntryDialog";



interface Trade {
  id: string;
  pair: string;
  side: "buy" | "sell";
  entry: number;
  exit: number;
  pnl: number;
  pnlPercent: number;
  date: string;
  riskReward: number;
  duration: string;
  strategy: string;

  accountType: "live" | "backtest"; // ✅ ADD THIS
}


interface TradeStats {
  totalTrades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  avgRR: number;
  profitFactor: number;
}


const calculateStats = (trades: Trade[]): TradeStats => {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgPnl: 0,
      totalPnl: 0,
      avgRR: 0,
      profitFactor: 0,
    };
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const totalPnl = trades.reduce((acc, t) => acc + t.pnl, 0);
  const avgPnl = totalPnl / trades.length;
  const avgRR = trades.reduce((acc, t) => acc + t.riskReward, 0) / trades.length;
  const grossProfit = wins.reduce((acc, t) => acc + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0));

  return {
    totalTrades: trades.length,
    winRate: (wins.length / trades.length) * 100,
    avgPnl,
    totalPnl,
    avgRR,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
  };
};



function StatComparison({ label, live, backtest, format = "number", higherIsBetter = true }: {
  label: string;
  live: number;
  backtest: number;
  format?: "number" | "percent" | "currency" | "ratio";
  higherIsBetter?: boolean;
}) {
  const formatValue = (val: number) => {
    switch (format) {
      case "percent": return `${val.toFixed(1)}%`;
      case "currency": return `$${val.toFixed(0)}`;
      case "ratio": return val === Infinity ? "∞" : val.toFixed(2);
      default: return val.toFixed(1);
    }
  };

  const diff = ((live - backtest) / Math.abs(backtest || 1)) * 100;
  const isPositive = higherIsBetter ? diff > 0 : diff < 0;

  return (
    <div className="glass-card p-4">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Live</p>
          <p className="text-lg font-mono font-semibold">{formatValue(live)}</p>
        </div>
        <div className="text-center">
          <Badge variant={isPositive ? "default" : "destructive"} className="text-xs">
            {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
          </Badge>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground mb-1">Backtest</p>
          <p className="text-lg font-mono font-semibold text-muted-foreground">{formatValue(backtest)}</p>
        </div>
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  return (
    <div className="p-4 hover:bg-accent/50 transition-colors border-b border-border last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            trade.side === "buy" ? "bg-success/10" : "bg-destructive/10"
          )}>
            {trade.side === "buy" ? (
              <ArrowUpRight className="w-5 h-5 text-success" />
            ) : (
              <ArrowDownRight className="w-5 h-5 text-destructive" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{trade.pair}</p>
              <Badge variant="outline" className="text-xs">{trade.strategy}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {trade.entry.toFixed(4)} → {trade.exit.toFixed(4)} • {trade.duration}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn(
            "font-mono font-medium",
            trade.pnl >= 0 ? "text-success" : "text-destructive"
          )}>
            {trade.pnl >= 0 ? "+" : ""}${trade.pnl}
          </p>
          <p className="text-sm text-muted-foreground">{trade.date}</p>
        </div>
      </div>
    </div>
  );
}

export function TradesSection() {
  const [activeTab, setActiveTab] = useState("compare");
  const { user } = useAuth();

  const [liveTrades, setLiveTrades] = useState<Trade[]>([]);
  const [backtestTrades, setBacktestTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const liveStats = calculateStats(liveTrades);
  const backtestStats = calculateStats(backtestTrades);

  const [addOpen, setAddOpen] = useState(false);

const [refreshKey, setRefreshKey] = useState(0);



 useEffect(() => {
  if (!user) return;

  (async () => {
    setLoading(true);

    // 1) Fetch all trades for the logged-in user (RLS filters automatically)
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch trades error:", error);
      setLoading(false);
      return;
    }

    // 2) Map DB rows → your UI Trade type
    const rows = data ?? [];

   const mapped: Trade[] = (rows ?? []).map((r: any) => ({
  id: r.id,
  pair: r.pair,
  side: (r.side ?? "buy") as "buy" | "sell",
  entry: Number(r.entry ?? 0),
  exit: Number(r.exit ?? 0),
  pnl: Number(r.pnl ?? 0),
  pnlPercent: Number(r.pnl_percent ?? 0),
  date: new Date(r.trade_time ?? r.created_at).toLocaleString(),
  riskReward: Number(r.risk_reward ?? 0),
  duration: r.duration ?? "-",
  strategy: r.strategy ?? "-",
  accountType: (r.account_type ?? "live") as "live" | "backtest",
}));

    // 3) If you have "account_type" (live/backtest) in DB, split here.
    // If you DON'T have it, just put everything into liveTrades for now.
setLiveTrades(mapped.filter(t => t.accountType === "live"));
setBacktestTrades(mapped.filter(t => t.accountType === "backtest"));


    setLoading(false);
  })();
}, [user, refreshKey]);


  return (
    <div className="space-y-6">
      {loading && (
  <div className="text-sm text-muted-foreground">Loading trades…</div>
)}

{!loading && liveTrades.length === 0 && backtestTrades.length === 0 && (
  <div className="text-sm text-muted-foreground">No trades yet.</div>
)}
<div className="flex items-center justify-end">
  <Button
  variant="glow"
  onClick={() => setAddOpen(true)}
  className="flex items-center gap-2 transition-transform hover:scale-[1.02]"
>
  <Plus className="w-4 h-4" />
  Add Entry
</Button>

</div>

<AddTradeDialog
  open={addOpen}
  onOpenChange={setAddOpen}
  onCreated={() => setRefreshKey((k) => k + 1)}
/>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="compare" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Compare
          </TabsTrigger>
          <TabsTrigger value="live" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Live Trading
          </TabsTrigger>
          <TabsTrigger value="backtest" className="flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            Backtesting
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compare" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatComparison label="Win Rate" live={liveStats.winRate} backtest={backtestStats.winRate} format="percent" />
            <StatComparison label="Total P&L" live={liveStats.totalPnl} backtest={backtestStats.totalPnl} format="currency" />
            <StatComparison label="Avg P&L" live={liveStats.avgPnl} backtest={backtestStats.avgPnl} format="currency" />
            <StatComparison label="Avg R:R" live={liveStats.avgRR} backtest={backtestStats.avgRR} format="ratio" />
            <StatComparison label="Total Trades" live={liveStats.totalTrades} backtest={backtestStats.totalTrades} />
            <StatComparison label="Profit Factor" live={liveStats.profitFactor} backtest={backtestStats.profitFactor} format="ratio" />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <h4 className="font-semibold">Live Trades</h4>
                <Badge className="ml-auto">{liveTrades.length}</Badge>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {liveTrades.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} />
                ))}
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <TestTube className="w-4 h-4 text-primary" />
                <h4 className="font-semibold">Backtest Trades</h4>
                <Badge variant="secondary" className="ml-auto">{backtestTrades.length}</Badge>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {backtestTrades.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="live" className="animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Trades</p>
              <p className="text-2xl font-mono font-semibold">{liveStats.totalTrades}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
              <p className="text-2xl font-mono font-semibold text-success">{liveStats.winRate.toFixed(1)}%</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Total P&L</p>
              <p className={cn("text-2xl font-mono font-semibold", liveStats.totalPnl >= 0 ? "text-success" : "text-destructive")}>
                ${liveStats.totalPnl}
              </p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Profit Factor</p>
              <p className="text-2xl font-mono font-semibold">{liveStats.profitFactor.toFixed(2)}</p>
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h4 className="font-semibold">All Live Trades</h4>
            </div>
            {liveTrades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="backtest" className="animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Trades</p>
              <p className="text-2xl font-mono font-semibold">{backtestStats.totalTrades}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
              <p className="text-2xl font-mono font-semibold text-success">{backtestStats.winRate.toFixed(1)}%</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Total P&L</p>
              <p className={cn("text-2xl font-mono font-semibold", backtestStats.totalPnl >= 0 ? "text-success" : "text-destructive")}>
                ${backtestStats.totalPnl}
              </p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Profit Factor</p>
              <p className="text-2xl font-mono font-semibold">{backtestStats.profitFactor.toFixed(2)}</p>
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h4 className="font-semibold">All Backtest Trades</h4>
            </div>
            {backtestTrades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
