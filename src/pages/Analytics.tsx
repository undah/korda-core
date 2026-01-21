import { MainLayout } from "@/components/layout/MainLayout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const weeklyPnL = [
  { day: "Mon", pnl: 320 },
  { day: "Tue", pnl: -180 },
  { day: "Wed", pnl: 450 },
  { day: "Thu", pnl: 280 },
  { day: "Fri", pnl: -120 },
  { day: "Sat", pnl: 0 },
  { day: "Sun", pnl: 0 },
];

const pairPerformance = [
  { name: "EUR/USD", value: 45, pnl: 1250 },
  { name: "GBP/JPY", value: 25, pnl: 890 },
  { name: "USD/CAD", value: 15, pnl: -320 },
  { name: "AUD/USD", value: 15, pnl: 420 },
];

const winLossData = [
  { name: "Wins", value: 32, color: "hsl(160 84% 39%)" },
  { name: "Losses", value: 15, color: "hsl(0 84% 60%)" },
];

const hourlyActivity = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  trades: Math.floor(Math.random() * 5),
  winRate: 40 + Math.floor(Math.random() * 40),
}));

export default function Analytics() {
  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics</h1>
        <p className="text-muted-foreground">Deep dive into your trading performance</p>
      </div>

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
                <YAxis stroke="hsl(215 20% 55%)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222 47% 10%)",
                    border: "1px solid hsl(222 30% 18%)",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`$${value}`, "P&L"]}
                />
                <Bar
                  dataKey="pnl"
                  radius={[4, 4, 0, 0]}
                  fill="hsl(173 80% 40%)"
                />
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
                <Pie
                  data={winLossData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {winLossData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222 47% 10%)",
                    border: "1px solid hsl(222 30% 18%)",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-4">
              {winLossData.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: item.color }}
                  />
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-2xl font-mono font-semibold">{item.value}</p>
                  </div>
                </div>
              ))}
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
            {pairPerformance.map((pair) => (
              <div key={pair.name} className="flex items-center gap-4">
                <div className="w-20 font-medium">{pair.name}</div>
                <div className="flex-1">
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pair.value}%`,
                        backgroundColor: pair.pnl >= 0 ? "hsl(160 84% 39%)" : "hsl(0 84% 60%)",
                      }}
                    />
                  </div>
                </div>
                <div className={`font-mono text-sm w-20 text-right ${pair.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                  {pair.pnl >= 0 ? "+" : ""}${pair.pnl}
                </div>
              </div>
            ))}
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
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222 47% 10%)",
                    border: "1px solid hsl(222 30% 18%)",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="winRate"
                  stroke="hsl(173 80% 40%)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
