import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { AIInsight } from "@/components/dashboard/AIInsight";
import { DollarSign, TrendingUp, Target, Activity } from "lucide-react";

export default function Dashboard() {
  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Track your trading performance and insights</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Balance"
          value="$11,440"
          change="+$1,440 (14.4%)"
          changeType="positive"
          icon={DollarSign}
        />
        <StatCard
          title="Win Rate"
          value="68.5%"
          change="+2.3% this week"
          changeType="positive"
          icon={Target}
        />
        <StatCard
          title="Profit Factor"
          value="2.14"
          change="Above target"
          changeType="positive"
          icon={TrendingUp}
        />
        <StatCard
          title="Total Trades"
          value="47"
          change="12 this week"
          changeType="neutral"
          icon={Activity}
        />
      </div>

      {/* Charts and Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <PerformanceChart />
          <RecentTrades />
        </div>
        <div className="space-y-6">
          <AIInsight />
        </div>
      </div>
    </MainLayout>
  );
}
