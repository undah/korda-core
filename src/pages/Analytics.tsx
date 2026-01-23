import { MainLayout } from "@/components/layout/MainLayout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from "recharts";
import { TrendingDown, TrendingUp, AlertTriangle, Calculator, Info } from "lucide-react";
import { cn } from "@/lib/utils";
const weeklyPnL = [{
  day: "Mon",
  pnl: 320
}, {
  day: "Tue",
  pnl: -180
}, {
  day: "Wed",
  pnl: 450
}, {
  day: "Thu",
  pnl: 280
}, {
  day: "Fri",
  pnl: -120
}, {
  day: "Sat",
  pnl: 0
}, {
  day: "Sun",
  pnl: 0
}];
const pairPerformance = [{
  name: "EUR/USD",
  value: 45,
  pnl: 1250
}, {
  name: "GBP/JPY",
  value: 25,
  pnl: 890
}, {
  name: "USD/CAD",
  value: 15,
  pnl: -320
}, {
  name: "AUD/USD",
  value: 15,
  pnl: 420
}];
const winLossData = [{
  name: "Wins",
  value: 32,
  color: "hsl(160 84% 39%)"
}, {
  name: "Losses",
  value: 15,
  color: "hsl(0 84% 60%)"
}];
const hourlyActivity = Array.from({
  length: 24
}, (_, i) => ({
  hour: `${i}:00`,
  trades: Math.floor(Math.random() * 5),
  winRate: 40 + Math.floor(Math.random() * 40)
}));

// Drawdown data over time (percentage)
const drawdownData = [{
  date: "Jan 1",
  drawdown: 0,
  equity: 10000
}, {
  date: "Jan 5",
  drawdown: -2.5,
  equity: 9750
}, {
  date: "Jan 10",
  drawdown: -1.2,
  equity: 9880
}, {
  date: "Jan 15",
  drawdown: -5.8,
  equity: 9420
}, {
  date: "Jan 20",
  drawdown: -3.2,
  equity: 9680
}, {
  date: "Jan 25",
  drawdown: -8.4,
  equity: 9160
}, {
  date: "Jan 30",
  drawdown: -4.1,
  equity: 9590
}, {
  date: "Feb 5",
  drawdown: -2.0,
  equity: 9800
}, {
  date: "Feb 10",
  drawdown: 0,
  equity: 10200
}, {
  date: "Feb 15",
  drawdown: -1.5,
  equity: 10050
}, {
  date: "Feb 20",
  drawdown: -6.2,
  equity: 9570
}, {
  date: "Feb 25",
  drawdown: -3.8,
  equity: 9810
}];

// Risk metrics calculations (mock data based on typical trading stats)
const riskMetrics = {
  expectedValue: 28.50,
  // Average expected profit per trade in dollars
  avgDrawdown: 3.42,
  // Average drawdown percentage
  maxDrawdown: 8.4,
  // Maximum drawdown percentage
  riskOfRuin: 2.3,
  // Risk of ruin percentage
  winRate: 0.681,
  avgWin: 185,
  avgLoss: 120,
  totalTrades: 47,
  profitFactor: 2.1
};
interface RiskStatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: "positive" | "negative" | "neutral";
  tooltip?: string;
}
function RiskStatCard({
  title,
  value,
  subtitle,
  icon,
  trend = "neutral",
  tooltip
}: RiskStatCardProps) {
  return <div className="glass-card p-5 animate-fade-in group relative">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", trend === "positive" && "bg-success/10", trend === "negative" && "bg-destructive/10", trend === "neutral" && "bg-primary/10")}>
          {icon}
        </div>
        {tooltip && <div className="relative">
            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
            <div className="absolute right-0 top-6 w-48 p-2 bg-popover border border-border rounded-lg text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {tooltip}
            </div>
          </div>}
      </div>
      <p className="text-sm text-muted-foreground mb-1">{title}</p>
      <p className={cn("text-2xl font-mono font-bold", trend === "positive" && "text-success", trend === "negative" && "text-destructive", trend === "neutral" && "text-foreground")}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>;
}
export default function Analytics() {
  return <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics</h1>
        <p className="text-muted-foreground">Deep dive into your trading performance</p>
      </div>

      {/* Risk Metrics Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Risk Metrics
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <RiskStatCard title="Expected Value" value={`$${riskMetrics.expectedValue.toFixed(2)}`} subtitle="Per trade expectancy" icon={<Calculator className="w-5 h-5 text-primary" />} trend="positive" tooltip="Average profit expected per trade based on win rate and average win/loss" />
          <RiskStatCard title="Average Drawdown" value={`${riskMetrics.avgDrawdown.toFixed(2)}%`} subtitle="Mean equity decline" icon={<TrendingDown className="w-5 h-5 text-warning" />} trend="neutral" tooltip="The average peak-to-trough decline in your equity curve" />
          <RiskStatCard title="Max Drawdown" value={`${riskMetrics.maxDrawdown.toFixed(2)}%`} subtitle="Largest equity drop" icon={<TrendingDown className="w-5 h-5 text-destructive" />} trend="negative" tooltip="The maximum observed loss from a peak to a trough before a new peak" />
          <RiskStatCard title="Risk of Ruin" value={`${riskMetrics.riskOfRuin.toFixed(1)}%`} subtitle="Probability of total loss" icon={<AlertTriangle className="w-5 h-5 text-destructive" />} trend={riskMetrics.riskOfRuin < 5 ? "positive" : "negative"} tooltip="Statistical probability of losing your entire trading capital" />
        </div>
      </div>

      {/* Drawdown Chart */}
      

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly P&L */}
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="font-semibold mb-1">Weekly P&L</h3>
          <p className="text-sm text-muted-foreground mb-4">Daily profit and loss this week</p>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyPnL}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
                <XAxis dataKey="day" stroke="hsl(215 20% 55%)" fontSize={12} />
                <YAxis stroke="hsl(215 20% 55%)" fontSize={12} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{
                backgroundColor: "hsl(222 47% 10%)",
                border: "1px solid hsl(222 30% 18%)",
                borderRadius: "8px"
              }} formatter={(value: number) => [`$${value}`, "P&L"]} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]} fill="hsl(173 80% 40%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win/Loss Ratio */}
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="font-semibold mb-1">Win/Loss Ratio</h3>
          <p className="text-sm text-muted-foreground mb-4">Trade outcome distribution</p>
          <div className="h-[250px] flex items-center">
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie data={winLossData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  {winLossData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{
                backgroundColor: "hsl(222 47% 10%)",
                border: "1px solid hsl(222 30% 18%)",
                borderRadius: "8px"
              }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-4">
              {winLossData.map(item => <div key={item.name} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{
                backgroundColor: item.color
              }} />
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-2xl font-mono font-semibold">{item.value}</p>
                  </div>
                </div>)}
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-mono font-semibold text-success">68.1%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pair Performance */}
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="font-semibold mb-1">Pair Performance</h3>
          <p className="text-sm text-muted-foreground mb-4">P&L breakdown by currency pair</p>
          <div className="space-y-4">
            {pairPerformance.map(pair => <div key={pair.name} className="flex items-center gap-4">
                <div className="w-20 font-medium">{pair.name}</div>
                <div className="flex-1">
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                  width: `${pair.value}%`,
                  backgroundColor: pair.pnl >= 0 ? "hsl(160 84% 39%)" : "hsl(0 84% 60%)"
                }} />
                  </div>
                </div>
                <div className={`font-mono text-sm w-20 text-right ${pair.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                  {pair.pnl >= 0 ? "+" : ""}${pair.pnl}
                </div>
              </div>)}
          </div>
        </div>

        {/* Trading Hours */}
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="font-semibold mb-1">Trading Activity by Hour</h3>
          <p className="text-sm text-muted-foreground mb-4">When you trade most and your win rate</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyActivity.slice(6, 22)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
                <XAxis dataKey="hour" stroke="hsl(215 20% 55%)" fontSize={10} />
                <YAxis stroke="hsl(215 20% 55%)" fontSize={12} />
                <Tooltip contentStyle={{
                backgroundColor: "hsl(222 47% 10%)",
                border: "1px solid hsl(222 30% 18%)",
                borderRadius: "8px"
              }} />
                <Line type="monotone" dataKey="winRate" stroke="hsl(173 80% 40%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </MainLayout>;
}