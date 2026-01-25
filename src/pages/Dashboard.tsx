import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { AIInsight } from "@/components/dashboard/AIInsight";
import { DollarSign, TrendingUp, Target, Activity } from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import { calcSummary } from "@/lib/tradeAnalytics";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AccountType = "live" | "backtest";

export default function Dashboard() {
  const [accountType, setAccountType] = useState<AccountType>("live");

  // ✅ Only fetch the selected bucket (live OR backtest)
  const { trades, loading } = useTrades({ accountType });

  const summary = useMemo(() => calcSummary(trades), [trades]);

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 text-muted-foreground">Loading dashboard…</div>
      </MainLayout>
    );
  }

  const modeLabel = accountType === "live" ? "Live" : "Backtest";

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Track your trading performance and insights ({modeLabel})
          </p>
        </div>

        {/* ✅ Toggle */}
        <Tabs value={accountType} onValueChange={(v) => setAccountType(v as AccountType)}>
          <TabsList>
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="backtest">Backtest</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title={`Total PnL (${modeLabel})`}
          value={`$${summary.totalPnL.toFixed(2)}`}
          change={`${summary.wins}W / ${summary.losses}L`}
          changeType={summary.totalPnL >= 0 ? "positive" : "negative"}
          icon={DollarSign}
        />

        <StatCard
          title={`Win Rate (${modeLabel})`}
          value={`${summary.winRate.toFixed(1)}%`}
          change={`${summary.wins} / ${summary.totalTrades} wins`}
          changeType={summary.winRate >= 50 ? "positive" : "negative"}
          icon={Target}
        />

        <StatCard
          title={`Profit Factor (${modeLabel})`}
          value={summary.profitFactor.toFixed(2)}
          change="Based on closed trades"
          changeType={summary.profitFactor >= 1.5 ? "positive" : "neutral"}
          icon={TrendingUp}
        />

        <StatCard
          title={`Total Trades (${modeLabel})`}
          value={summary.totalTrades.toString()}
          change="All time"
          changeType="neutral"
          icon={Activity}
        />
      </div>

      {/* Charts & Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <PerformanceChart trades={trades} />
          <RecentTrades trades={trades.slice(0, 5)} />
        </div>

        <div className="space-y-6">
          <AIInsight trades={trades} />
        </div>
      </div>
    </MainLayout>
  );
}
