import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { date: "Jan 1", balance: 10000 },
  { date: "Jan 5", balance: 10420 },
  { date: "Jan 10", balance: 10180 },
  { date: "Jan 15", balance: 10850 },
  { date: "Jan 18", balance: 11200 },
  { date: "Jan 20", balance: 10980 },
  { date: "Jan 21", balance: 11440 },
];

export function PerformanceChart() {
  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="mb-6">
        <h3 className="font-semibold">Account Performance</h3>
        <p className="text-sm text-muted-foreground">Balance over time</p>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(173 80% 40%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(173 80% 40%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(215 20% 55%)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="hsl(215 20% 55%)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(222 47% 10%)",
                border: "1px solid hsl(222 30% 18%)",
                borderRadius: "8px",
                boxShadow: "0 4px 24px hsl(222 47% 4% / 0.5)",
              }}
              labelStyle={{ color: "hsl(210 40% 98%)" }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, "Balance"]}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="hsl(173 80% 40%)"
              strokeWidth={2}
              fill="url(#balanceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
