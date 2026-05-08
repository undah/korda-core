import React, { useState } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { useTrackerCheckins, useTrackerGoal, useProgressStats } from "@/features/tracker/hooks/useTrackerCheckins";

const isMobile = () => window.innerWidth <= 768;

const C = {
  accent: "#00C8FF",
  line:   "#5ab4d4",
  green:  "#5ad4a0",
  red:    "#d4705a",
  text:   "#dde8ed",
  muted:  "rgba(221,232,237,0.32)",
  dim:    "rgba(221,232,237,0.15)",
};

// ── Custom tooltip ────────────────────────────────────────────────────────────

function WeightTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const w = payload.find((p: any) => p.dataKey === "weight");
  const a = payload.find((p: any) => p.dataKey === "avg7");
  const date = payload[0]?.payload?.date;
  return (
    <div style={{ background: "#0C0C18", border: "1px solid rgba(0,200,255,0.2)", borderRadius: 10, padding: "0.65rem 0.9rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}>
      <p style={{ color: C.muted, marginBottom: "0.35rem" }}>{date ? format(parseISO(date), "EEE, MMM d yyyy") : ""}</p>
      {w && <p style={{ color: C.accent, fontWeight: 500, fontSize: "0.85rem" }}>{w.value} kg</p>}
      {a && <p style={{ color: `${C.line}99`, marginTop: "0.2rem" }}>7d avg: {a.value} kg</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TrackerAnalysis() {
  const { data: checkins = [] } = useTrackerCheckins(365);
  const { data: goal }          = useTrackerGoal();
  const stats                   = useProgressStats();
  const [mobile]                = useState(isMobile);

  const sorted = [...checkins].sort((a, b) => a.log_date.localeCompare(b.log_date));

  const weeklyData = buildWeekly(sorted);
  const withWaist  = sorted.filter(c => c.waist);
  const withChest  = sorted.filter(c => c.chest);
  const firstDate  = sorted[0]?.log_date;
  const lastDate   = sorted[sorted.length - 1]?.log_date;
  const totalDays  = firstDate && lastDate
    ? Math.round((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86400000) + 1
    : 0;
  const adherence = totalDays > 0 ? Math.round((sorted.length / totalDays) * 100) : 0;

  // Build chart data with 7d rolling avg
  const chartData = sorted.map((c, i) => {
    const slice = sorted.slice(Math.max(0, i - 6), i + 1);
    const avg7  = +(slice.reduce((s, x) => s + x.weight, 0) / slice.length).toFixed(2);
    return { date: c.log_date, weight: c.weight, avg7 };
  });

  const weights = chartData.map(d => d.weight);
  const goalVal = goal?.goal_weight;
  const allVals = goalVal ? [...weights, goalVal] : weights;
  const yMin    = allVals.length ? Math.floor(Math.min(...allVals) - 1.5) : 0;
  const yMax    = allVals.length ? Math.ceil(Math.max(...allVals)  + 1.5) : 100;

  if (sorted.length < 3) return (
    <div>
      <div className="kt-page-header">
        <p className="kt-page-eyebrow">Analysis</p>
        <h1 className="kt-page-title">In-depth <em>analysis</em></h1>
      </div>
      <div className="kt-card" style={{ textAlign: "center", padding: "4rem 1.5rem" }}>
        <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem", marginBottom: "1rem" }}>Need more data.</p>
        <p style={{ color: "rgba(221,232,237,0.4)", fontSize: "0.9rem" }}>Log at least 3 check-ins to see your analysis.</p>
      </div>
    </div>
  );

  return (
    <div>
      <div className="kt-page-header">
        <p className="kt-page-eyebrow">Analysis</p>
        <h1 className="kt-page-title">In-depth <em>analysis</em></h1>
      </div>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 2, marginBottom: 2 }}>
        <div className="kt-card">
          <p className="kt-card-label">Total lost</p>
          <p className="kt-card-value" style={{ color: stats && stats.totalLost > 0 ? C.green : C.red }}>{stats ? `${Math.abs(stats.totalLost)} kg` : "—"}</p>
          <p className="kt-card-sub">since first check-in</p>
        </div>
        <div className="kt-card">
          <p className="kt-card-label">Goal</p>
          <p className="kt-card-value">{stats ? `${stats.percentToGoal}%` : "—"}</p>
          <p className="kt-card-sub">{goalVal ? `target: ${goalVal} kg` : "no goal set"}</p>
        </div>
        <div className="kt-card">
          <p className="kt-card-label">Arrival</p>
          <p className="kt-card-value" style={{ fontSize: "1rem", color: C.text }}>{stats?.daysToGoal ? projectedDate(stats.daysToGoal) : "—"}</p>
          <p className="kt-card-sub">{stats?.daysToGoal ? `${stats.daysToGoal} days remaining` : "set a goal"}</p>
        </div>
        <div className="kt-card">
          <p className="kt-card-label">Adherence</p>
          <p className="kt-card-value" style={{ color: adherence >= 70 ? C.green : adherence >= 50 ? C.accent : C.red }}>{adherence}%</p>
          <p className="kt-card-sub">{sorted.length} of {totalDays} days logged</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 2, marginBottom: "1.5rem" }}>
        <div className="kt-card">
          <p className="kt-card-label">Avg weekly loss</p>
          <p className="kt-card-value">{stats ? `${stats.avgWeeklyLoss} kg` : "—"}</p>
          <p className="kt-card-sub">rolling trend</p>
        </div>
        <div className="kt-card">
          <p className="kt-card-label">Best week</p>
          <p className="kt-card-value">{stats ? `${stats.bestWeek} kg` : "—"}</p>
          <p className="kt-card-sub">largest 7d drop</p>
        </div>
      </div>

      {/* Full weight history chart */}
      <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
        <p className="kt-card-label" style={{ marginBottom: "0.3rem" }}>Full weight history</p>
        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.68rem", color: C.dim, marginBottom: "1.5rem" }}>
          Raw data + 7-day rolling average{goalVal ? `  ·  Goal: ${goalVal} kg` : ""}
        </p>

        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="analysisGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#5ab4d4" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#5ab4d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={d => { try { return format(parseISO(d), "MMM d"); } catch { return ""; } }}
              tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: "rgba(221,232,237,0.22)" }}
              axisLine={false} tickLine={false} interval="preserveStartEnd"
            />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={v => `${v}`}
              tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: "rgba(221,232,237,0.22)" }}
              axisLine={false} tickLine={false} tickCount={6} width={32}
            />
            <Tooltip content={<WeightTooltip />} cursor={{ stroke: "rgba(0,200,255,0.12)", strokeWidth: 1 }} />

            {goalVal && (
              <ReferenceLine
                y={goalVal}
                stroke="rgba(90,212,160,0.3)"
                strokeDasharray="6 4"
                strokeWidth={1}
                label={{ value: `goal: ${goalVal} kg`, position: "insideTopRight", fill: "rgba(90,212,160,0.45)", fontFamily: "'IBM Plex Mono',monospace", fontSize: 9 }}
              />
            )}

            <Area type="monotone" dataKey="avg7" fill="url(#analysisGrad)" stroke="none" dot={false} activeDot={false} />
            <Line type="monotone" dataKey="weight" stroke="rgba(90,180,212,0.28)" strokeWidth={1} strokeDasharray="3 4"
              dot={{ r: 2, fill: "rgba(90,180,212,0.45)", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#00C8FF", strokeWidth: 2, stroke: "rgba(0,200,255,0.3)" }}
            />
            <Line type="monotone" dataKey="avg7" stroke="#5ab4d4" strokeWidth={2} dot={false} activeDot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly breakdown */}
      <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
        <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Weekly breakdown</p>
        {mobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {weeklyData.map((w, i) => {
              const prev = weeklyData[i - 1];
              const change = prev ? +(w.avg - prev.avg).toFixed(1) : null;
              return (
                <div key={w.week} style={{ padding: "0.75rem", background: "#08080f", borderLeft: "2px solid rgba(90,180,212,0.15)", borderRadius: "0 6px 6px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.68rem", color: "rgba(221,232,237,0.35)" }}>{w.week}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.68rem", color: C.accent }}>{w.avg} kg</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 3 }}>
                      {Array.from({ length: 7 }).map((_, d) => (
                        <div key={d} style={{ width: 6, height: 6, background: d < w.count ? "rgba(90,180,212,0.6)" : "rgba(90,180,212,0.1)", borderRadius: 1 }} />
                      ))}
                    </div>
                    {change !== null && (
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: change < 0 ? C.green : C.red }}>
                        {change > 0 ? "+" : ""}{change} kg
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr>
                {["Week", "Avg weight", "Change", "Entries", "Trend"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(221,232,237,0.22)", borderBottom: "1px solid rgba(90,180,212,0.06)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeklyData.map((w, i) => {
                const prev = weeklyData[i - 1];
                const change = prev ? +(w.avg - prev.avg).toFixed(1) : null;
                return (
                  <tr key={w.week} style={{ borderBottom: "1px solid rgba(90,180,212,0.04)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: "rgba(221,232,237,0.35)" }}>{w.week}</td>
                    <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", color: C.accent }}>{w.avg} kg</td>
                    <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", color: change === null ? "rgba(221,232,237,0.2)" : change < 0 ? C.green : C.red }}>
                      {change === null ? "—" : `${change > 0 ? "+" : ""}${change} kg`}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", color: "rgba(221,232,237,0.35)" }}>{w.count}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      <div style={{ display: "flex", gap: 3 }}>
                        {Array.from({ length: 7 }).map((_, d) => (
                          <div key={d} style={{ width: 7, height: 7, background: d < w.count ? "rgba(90,180,212,0.55)" : "rgba(90,180,212,0.08)", borderRadius: 1 }} />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Measurement trends */}
      {withWaist.length > 1 && (
        <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
          <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Measurement trends</p>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 2 }}>
            {[
              { label: "Waist", arr: withWaist, key: "waist" as const },
              { label: "Chest", arr: withChest, key: "chest" as const },
            ].map(m => {
              const first = m.arr[0]?.[m.key];
              const last  = m.arr[m.arr.length - 1]?.[m.key];
              const delta = first && last ? +(+last - +first).toFixed(1) : null;
              return (
                <div key={m.label} className="kt-card" style={{ border: "none", borderTop: "1px solid rgba(90,180,212,0.1)", background: "#0a0a14" }}>
                  <p className="kt-card-label">{m.label}</p>
                  {first && last ? (
                    <>
                      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.85rem", color: C.text }}>{first} → {last} cm</p>
                      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem", color: delta && delta < 0 ? C.green : C.red, marginTop: "0.3rem" }}>
                        {delta !== null ? `${delta > 0 ? "+" : ""}${delta} cm` : ""}
                      </p>
                    </>
                  ) : (
                    <p style={{ color: "rgba(221,232,237,0.2)", fontSize: "0.82rem" }}>No data</p>
                  )}
                </div>
              );
            })}
            <div className="kt-card" style={{ border: "none", borderTop: "1px solid rgba(90,180,212,0.1)", background: "#0a0a14" }}>
              <p className="kt-card-label">Waist Δ</p>
              {withWaist.length > 1 ? (() => {
                const delta = +(+(withWaist[withWaist.length-1].waist ?? 0) - +(withWaist[0].waist ?? 0)).toFixed(1);
                return <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.1rem", color: delta < 0 ? C.green : C.red }}>{delta > 0 ? "+" : ""}{delta} cm</p>;
              })() : <p style={{ color: "rgba(221,232,237,0.2)", fontSize: "0.82rem" }}>No data</p>}
            </div>
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="kt-card">
        <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Insights</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {generateInsights(stats, adherence, sorted).map((insight, i) => (
            <div key={i} style={{ display: "flex", gap: "0.75rem", padding: "0.8rem 1rem", background: "#08080f", borderLeft: `2px solid ${insight.color}`, borderRadius: "0 8px 8px 0" }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", color: insight.color, flexShrink: 0, marginTop: "0.1rem" }}>{insight.tag}</span>
              <p style={{ fontSize: "0.82rem", color: "rgba(221,232,237,0.55)", lineHeight: 1.65 }}>{insight.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function projectedDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function buildWeekly(sorted: { log_date: string; weight: number }[]) {
  const weeks: Record<string, { weights: number[]; count: number }> = {};
  sorted.forEach(c => {
    const d = new Date(c.log_date);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = monday.toISOString().split("T")[0];
    if (!weeks[key]) weeks[key] = { weights: [], count: 0 };
    weeks[key].weights.push(c.weight);
    weeks[key].count++;
  });
  return Object.entries(weeks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { weights, count }]) => ({
      week,
      avg: +(weights.reduce((s, w) => s + w, 0) / weights.length).toFixed(1),
      count,
    }));
}

function generateInsights(
  stats: ReturnType<typeof useProgressStats>,
  adherence: number,
  sorted: { weight: number; log_date: string }[]
) {
  const insights: { tag: string; text: string; color: string }[] = [];

  if (adherence >= 80)
    insights.push({ tag: "consistency", color: "#5ad4a0", text: `You've logged ${adherence}% of days — excellent consistency. This is one of the strongest predictors of long-term success.` });
  else if (adherence < 50)
    insights.push({ tag: "consistency", color: "#d4705a", text: `You've only logged ${adherence}% of days. More frequent check-ins will give you a clearer, more accurate trend.` });

  if (stats && stats.avgWeeklyLoss >= 0.5 && stats.avgWeeklyLoss <= 1)
    insights.push({ tag: "rate", color: "#5ad4a0", text: `Your average weekly loss of ${stats.avgWeeklyLoss} kg is in the optimal range (0.5–1 kg/week).` });
  else if (stats && stats.avgWeeklyLoss > 1.2)
    insights.push({ tag: "rate", color: "#d4b45a", text: `You're losing ${stats.avgWeeklyLoss} kg/week — faster than ideal. Consider a slightly higher intake to preserve muscle.` });

  if (stats?.daysToGoal)
    insights.push({ tag: "projection", color: "#5ab4d4", text: `At your current pace, you'll reach your goal in approximately ${stats.daysToGoal} days (${projectedDate(stats.daysToGoal)}).` });

  if (insights.length === 0)
    insights.push({ tag: "info", color: "rgba(90,180,212,0.5)", text: "Keep logging consistently. More data will unlock deeper insights and more accurate projections." });

  return insights;
}
