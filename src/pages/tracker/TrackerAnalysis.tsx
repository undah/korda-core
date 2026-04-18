// src/pages/tracker/TrackerAnalysis.tsx
import React, { useState } from "react";
import { useTrackerCheckins, useTrackerGoal, useProgressStats } from "@/features/tracker/hooks/useTrackerCheckins";
import { useTrackerCalories } from "@/features/tracker/hooks/useTrackerJournal";

const isMobile = () => window.innerWidth <= 768;

export default function TrackerAnalysis() {
  const { data: checkins = [] } = useTrackerCheckins(90);
  const { data: goal } = useTrackerGoal();
  const { data: calories = [] } = useTrackerCalories(30);
  const stats = useProgressStats();
  const [mobile] = useState(isMobile);

  const sorted = [...checkins].sort((a, b) => a.log_date.localeCompare(b.log_date));
  const weeklyData = buildWeekly(sorted);
  const withWaist  = sorted.filter(c => c.waist);
  const withChest  = sorted.filter(c => c.chest);
  const firstWaist = withWaist[0]?.waist;
  const lastWaist  = withWaist[withWaist.length - 1]?.waist;
  const waistDelta = firstWaist && lastWaist ? +(lastWaist - firstWaist).toFixed(1) : null;
  const avgCal     = calories.length ? Math.round(calories.reduce((s,c) => s + c.calories_in, 0) / calories.length) : null;
  const avgDeficit = calories.length ? Math.round(calories.reduce((s,c) => s + c.deficit, 0) / calories.length) : null;
  const firstDate  = sorted[0]?.log_date;
  const lastDate   = sorted[sorted.length - 1]?.log_date;
  const totalDays  = firstDate && lastDate ? Math.round((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86400000) + 1 : 0;
  const adherence  = totalDays > 0 ? Math.round((sorted.length / totalDays) * 100) : 0;

  if (sorted.length < 3) {
    return (
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
  }

  return (
    <div>
      <div className="kt-page-header">
        <p className="kt-page-eyebrow">Analysis</p>
        <h1 className="kt-page-title">In-depth <em>analysis</em></h1>
      </div>

      {/* stats — 2x2 on mobile, 4 col on desktop */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginBottom: 2 }}>
        <div className="kt-card">
          <p className="kt-card-label">Total lost</p>
          <p className="kt-card-value">{stats ? `${Math.abs(stats.totalLost)} kg` : "—"}</p>
          <p className="kt-card-sub">since first check-in</p>
        </div>
        <div className="kt-card">
          <p className="kt-card-label">Goal</p>
          <p className="kt-card-value">{stats ? `${stats.percentToGoal}%` : "—"}</p>
          <p className="kt-card-sub">{goal?.goal_weight ? `target: ${goal.goal_weight} kg` : "no goal set"}</p>
        </div>
        <div className="kt-card">
          <p className="kt-card-label">Arrival</p>
          <p className="kt-card-value" style={{ fontSize: "1rem" }}>{stats?.daysToGoal ? projectedDate(stats.daysToGoal) : "—"}</p>
          <p className="kt-card-sub">{stats?.daysToGoal ? `${stats.daysToGoal} days` : "set a goal"}</p>
        </div>
        <div className="kt-card">
          <p className="kt-card-label">Adherence</p>
          <p className="kt-card-value">{adherence}%</p>
          <p className="kt-card-sub">{sorted.length} of {totalDays} days</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginBottom: "1.5rem" }}>
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
        <div className="kt-card">
          <p className="kt-card-label">Avg calories</p>
          <p className="kt-card-value" style={{ fontSize: "1.1rem" }}>{avgCal ?? "—"}</p>
          <p className="kt-card-sub">last 30 days</p>
        </div>
        <div className="kt-card">
          <p className="kt-card-label">Avg deficit</p>
          <p className="kt-card-value" style={{ color: avgDeficit && avgDeficit > 0 ? "#5ad4a0" : "#d4705a", fontSize: "1.1rem" }}>
            {avgDeficit !== null ? `${avgDeficit > 0 ? "-" : "+"}${Math.abs(avgDeficit)}` : "—"}
          </p>
          <p className="kt-card-sub">kcal</p>
        </div>
      </div>

      {/* weight chart */}
      <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
        <p className="kt-card-label" style={{ marginBottom: "1.5rem" }}>Full weight history</p>
        <FullChart checkins={sorted} goal={goal?.goal_weight} />
      </div>

      {/* weekly breakdown — scrollable on mobile */}
      <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
        <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Weekly breakdown</p>
        {mobile ? (
          /* MOBILE: card list */
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {weeklyData.map((w, i) => {
              const prev = weeklyData[i - 1];
              const change = prev ? +(w.avg - prev.avg).toFixed(1) : null;
              return (
                <div key={w.week} style={{ padding: "0.75rem", background: "#0a0e12", borderLeft: "2px solid rgba(90,180,212,0.15)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.68rem", color: "rgba(221,232,237,0.4)" }}>{w.week}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.68rem", color: "#5ab4d4" }}>{w.avg} kg</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 2 }}>
                      {Array.from({ length: 7 }).map((_, d) => (
                        <div key={d} style={{ width: 7, height: 7, background: d < w.count ? "rgba(90,180,212,0.6)" : "rgba(90,180,212,0.1)" }} />
                      ))}
                    </div>
                    {change !== null && (
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: change < 0 ? "#5ad4a0" : "#d4705a" }}>
                        {change > 0 ? "+" : ""}{change} kg
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* DESKTOP: table */
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr>
                {["Week","Avg weight","Change","Entries","Trend"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(221,232,237,0.25)", borderBottom: "1px solid rgba(90,180,212,0.07)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeklyData.map((w, i) => {
                const prev = weeklyData[i - 1];
                const change = prev ? +(w.avg - prev.avg).toFixed(1) : null;
                return (
                  <tr key={w.week} style={{ borderBottom: "1px solid rgba(90,180,212,0.04)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: "rgba(221,232,237,0.4)" }}>{w.week}</td>
                    <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", color: "#5ab4d4" }}>{w.avg} kg</td>
                    <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", color: change === null ? "rgba(221,232,237,0.2)" : change < 0 ? "#5ad4a0" : "#d4705a" }}>
                      {change === null ? "—" : `${change > 0 ? "+" : ""}${change} kg`}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", color: "rgba(221,232,237,0.4)" }}>{w.count}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      <div style={{ display: "flex", gap: 2 }}>
                        {Array.from({ length: 7 }).map((_, d) => (
                          <div key={d} style={{ width: 8, height: 8, background: d < w.count ? "rgba(90,180,212,0.6)" : "rgba(90,180,212,0.1)" }} />
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

      {/* measurements */}
      {withWaist.length > 1 && (
        <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
          <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Measurement trends</p>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 2 }}>
            {[
              { label: "Waist", first: withWaist[0]?.waist, last: withWaist[withWaist.length-1]?.waist },
              { label: "Chest", first: withChest[0]?.chest, last: withChest[withChest.length-1]?.chest },
              { label: "Waist Δ", first: null, last: null, delta: waistDelta },
            ].map(m => {
              const delta = m.delta !== undefined ? m.delta : (m.first && m.last ? +(m.last - m.first).toFixed(1) : null);
              return (
                <div key={m.label} className="kt-card" style={{ border: "none", borderTop: "1px solid rgba(90,180,212,0.1)", background: "#0f151a" }}>
                  <p className="kt-card-label">{m.label}</p>
                  {m.first && m.last ? (
                    <>
                      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.85rem", color: "#dde8ed" }}>{m.first} → {m.last} cm</p>
                      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem", color: delta && delta < 0 ? "#5ad4a0" : "#d4705a", marginTop: "0.3rem" }}>
                        {delta !== null ? `${delta > 0 ? "+" : ""}${delta} cm` : ""}
                      </p>
                    </>
                  ) : delta !== null ? (
                    <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.1rem", color: delta < 0 ? "#5ad4a0" : "#d4705a" }}>
                      {delta > 0 ? "+" : ""}{delta} cm
                    </p>
                  ) : (
                    <p style={{ color: "rgba(221,232,237,0.2)", fontSize: "0.82rem" }}>No data</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* insights */}
      <div className="kt-card">
        <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Insights</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {generateInsights(stats, adherence, avgDeficit, sorted).map((insight, i) => (
            <div key={i} style={{ display: "flex", gap: "0.75rem", padding: "0.75rem", background: "#0a0e12", borderLeft: `2px solid ${insight.color}` }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.68rem", color: insight.color, flexShrink: 0 }}>{insight.tag}</span>
              <p style={{ fontSize: "0.82rem", color: "rgba(221,232,237,0.6)", lineHeight: 1.65 }}>{insight.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

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
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([week, { weights, count }]) => ({
      week,
      avg: +(weights.reduce((s,w) => s+w, 0) / weights.length).toFixed(1),
      count,
    }));
}

function generateInsights(
  stats: ReturnType<typeof useProgressStats>,
  adherence: number,
  avgDeficit: number | null,
  sorted: { weight: number; log_date: string }[]
) {
  const insights: { tag: string; text: string; color: string }[] = [];
  if (adherence >= 80) insights.push({ tag: "consistency", color: "#5ad4a0", text: `You've logged ${adherence}% of days — excellent consistency. This is one of the strongest predictors of success.` });
  else if (adherence < 50) insights.push({ tag: "consistency", color: "#d4705a", text: `You've only logged ${adherence}% of days. More frequent check-ins will give you a clearer trend.` });
  if (stats && stats.avgWeeklyLoss >= 0.5 && stats.avgWeeklyLoss <= 1) {
    insights.push({ tag: "rate", color: "#5ad4a0", text: `Your average weekly loss of ${stats.avgWeeklyLoss} kg is in the optimal range (0.5–1 kg/week).` });
  } else if (stats && stats.avgWeeklyLoss > 1.2) {
    insights.push({ tag: "rate", color: "#d4b45a", text: `You're losing ${stats.avgWeeklyLoss} kg/week — faster than ideal. Consider a slightly higher calorie intake to preserve muscle.` });
  }
  if (avgDeficit && avgDeficit > 800) {
    insights.push({ tag: "deficit", color: "#d4705a", text: `Your average deficit of ${avgDeficit} kcal is aggressive. Consider a more moderate 300–600 kcal deficit.` });
  } else if (avgDeficit && avgDeficit >= 300 && avgDeficit <= 600) {
    insights.push({ tag: "deficit", color: "#5ad4a0", text: `A ${avgDeficit} kcal average daily deficit is sustainable and effective.` });
  }
  if (stats?.daysToGoal) {
    insights.push({ tag: "projection", color: "#5ab4d4", text: `At your current pace, you'll reach your goal in approximately ${stats.daysToGoal} days (${projectedDate(stats.daysToGoal)}).` });
  }
  if (insights.length === 0) {
    insights.push({ tag: "info", color: "rgba(90,180,212,0.5)", text: "Keep logging consistently. More data will unlock deeper insights and more accurate projections." });
  }
  return insights;
}

function FullChart({ checkins, goal }: { checkins: { weight: number; log_date: string }[]; goal?: number | null }) {
  if (checkins.length < 2) return null;
  const W = 800, H = 180, PAD = 28;
  const weights = checkins.map(c => c.weight);
  const allVals = goal ? [...weights, goal] : weights;
  const min = Math.min(...allVals) - 1;
  const max = Math.max(...allVals) + 1;
  const xp = (i: number) => PAD + (i / (checkins.length - 1)) * (W - PAD * 2);
  const yp = (w: number) => H - PAD - ((w - min) / (max - min)) * (H - PAD * 2);
  const linePath = checkins.map((c, i) => `${i === 0 ? "M" : "L"}${xp(i)},${yp(c.weight)}`).join(" ");
  const avgPoints = checkins.map((_, i) => {
    const slice = checkins.slice(Math.max(0, i - 6), i + 1);
    const avg = slice.reduce((s,c) => s + c.weight, 0) / slice.length;
    return { x: xp(i), y: yp(avg) };
  });
  const avgPath = avgPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${avgPath} L${avgPoints[avgPoints.length-1].x},${H} L${avgPoints[0].x},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="none">
      {[0.25,0.5,0.75].map(t => {
        const yy = PAD + t * (H - PAD * 2);
        const val = max - t * (max - min);
        return (
          <g key={t}>
            <line x1={PAD} y1={yy} x2={W - PAD} y2={yy} stroke="rgba(90,180,212,0.06)" strokeWidth="1" />
            <text x={PAD - 4} y={yy + 4} fill="rgba(90,180,212,0.3)" fontFamily="IBM Plex Mono,monospace" fontSize="9" textAnchor="end">{val.toFixed(1)}</text>
          </g>
        );
      })}
      {goal && (
        <>
          <line x1={PAD} y1={yp(goal)} x2={W - PAD} y2={yp(goal)} stroke="rgba(90,212,160,0.25)" strokeWidth="1" strokeDasharray="5 3" />
          <text x={W - PAD + 4} y={yp(goal) + 4} fill="rgba(90,212,160,0.5)" fontFamily="IBM Plex Mono,monospace" fontSize="9">goal</text>
        </>
      )}
      <path d={areaPath} fill="rgba(90,180,212,0.05)" />
      <path d={linePath} fill="none" stroke="rgba(90,180,212,0.18)" strokeWidth="1" strokeDasharray="2 3" />
      <path d={avgPath} fill="none" stroke="rgba(90,180,212,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xp(checkins.length - 1)} cy={yp(checkins[checkins.length - 1].weight)} r="4" fill="#5ab4d4" />
      <circle cx={xp(0)} cy={yp(checkins[0].weight)} r="3" fill="rgba(90,180,212,0.4)" />
    </svg>
  );
}
