import { useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TestTube, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface Trade {
  id: string;
  pair: string;
  type: "buy" | "sell";
  entry: number;
  exit: number;
  pnl: number;
  pnlPercent: number;
  date: string;
  riskReward: number;
  duration: string;
  strategy: string;
}

interface TradeStats {
  totalTrades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  avgRR: number;
  profitFactor: number;
}

const mockLiveTrades: Trade[] = [
  { id: "l1", pair: "EUR/USD", type: "buy", entry: 1.0850, exit: 1.0892, pnl: 420, pnlPercent: 2.1, date: "Jan 21, 14:32", riskReward: 2.1, duration: "4h 15m", strategy: "Breakout" },
  { id: "l2", pair: "GBP/JPY", type: "sell", entry: 188.450, exit: 187.920, pnl: 530, pnlPercent: 2.8, date: "Jan 21, 11:15", riskReward: 2.8, duration: "2h 45m", strategy: "Reversal" },
  { id: "l3", pair: "USD/CAD", type: "buy", entry: 1.3620, exit: 1.3580, pnl: -280, pnlPercent: -1.4, date: "Jan 20, 09:30", riskReward: -1.4, duration: "1h 20m", strategy: "Trend" },
  { id: "l4", pair: "AUD/USD", type: "sell", entry: 0.6540, exit: 0.6495, pnl: 450, pnlPercent: 2.3, date: "Jan 19, 16:45", riskReward: 2.3, duration: "5h 30m", strategy: "Supply/Demand" },
  { id: "l5", pair: "EUR/GBP", type: "buy", entry: 0.8580, exit: 0.8612, pnl: 320, pnlPercent: 1.6, date: "Jan 18, 10:20", riskReward: 1.6, duration: "3h 10m", strategy: "Range" },
];

const mockBacktestTrades: Trade[] = [
  { id: "b1", pair: "EUR/USD", type: "buy", entry: 1.0820, exit: 1.0878, pnl: 580, pnlPercent: 2.9, date: "Dec 15, 09:00", riskReward: 2.9, duration: "6h 00m", strategy: "Breakout" },
  { id: "b2", pair: "GBP/JPY", type: "sell", entry: 186.200, exit: 185.400, pnl: 800, pnlPercent: 4.0, date: "Dec 14, 14:30", riskReward: 4.0, duration: "8h 15m", strategy: "Reversal" },
  { id: "b3", pair: "USD/CAD", type: "sell", entry: 1.3680, exit: 1.3720, pnl: -400, pnlPercent: -2.0, date: "Dec 13, 11:00", riskReward: -2.0, duration: "2h 45m", strategy: "Trend" },
  { id: "b4", pair: "AUD/USD", type: "buy", entry: 0.6480, exit: 0.6545, pnl: 650, pnlPercent: 3.3, date: "Dec 12, 08:15", riskReward: 3.3, duration: "4h 30m", strategy: "Supply/Demand" },
  { id: "b5", pair: "EUR/GBP", type: "sell", entry: 0.8620, exit: 0.8575, pnl: 450, pnlPercent: 2.3, date: "Dec 11, 15:45", riskReward: 2.3, duration: "3h 50m", strategy: "Range" },
  { id: "b6", pair: "USD/JPY", type: "buy", entry: 148.200, exit: 148.850, pnl: 650, pnlPercent: 3.3, date: "Dec 10, 10:00", riskReward: 3.3, duration: "5h 20m", strategy: "Breakout" },
];

const calculateStats = (trades: Trade[]): TradeStats => {
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

const liveStats = calculateStats(mockLiveTrades);
const backtestStats = calculateStats(mockBacktestTrades);

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
            trade.type === "buy" ? "bg-success/10" : "bg-destructive/10"
          )}>
            {trade.type === "buy" ? (
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

  return (
    <div className="space-y-6">
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
                <Badge className="ml-auto">{mockLiveTrades.length}</Badge>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {mockLiveTrades.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} />
                ))}
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <TestTube className="w-4 h-4 text-primary" />
                <h4 className="font-semibold">Backtest Trades</h4>
                <Badge variant="secondary" className="ml-auto">{mockBacktestTrades.length}</Badge>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {mockBacktestTrades.map((trade) => (
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
            {mockLiveTrades.map((trade) => (
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
            {mockBacktestTrades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
