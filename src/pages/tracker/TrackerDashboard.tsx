import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, parseISO, subDays } from "date-fns";
import { useTrackerCheckins, useTrackerGoal, useProgressStats } from "@/features/tracker/hooks/useTrackerCheckins";

type Range = "1W" | "1M" | "3M" | "All";
const RANGES: Range[] = ["1W", "1M", "3M", "All"];
const RANGE_DAYS: Record<Range, number | null> = { "1W": 7, "1M": 30, "3M": 90, "All": null };

const C = {
  accent:  "#00C8FF",
  line:    "#5ab4d4",
  green:   "#5ad4a0",
  red:     "#d4705a",
  text:    "#dde8ed",
  muted:   "rgba(221,232,237,0.32)",
  dim:     "rgba(221,232,237,0.15)",
  card:    "#0D0D16",
  border:  "rgba(0,200,255,0.07)",
  accent2: "rgba(0,200,255,0.18)",
};

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="kt-card">
      <p className="kt-card-label">{label}</p>
      <p className="kt-card-value" style={{ color: color ?? C.accent }}>{value}</p>
      {sub && <p className="kt-card-sub">{sub}</p>}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function WeightTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const w = payload.find((p: any) => p.dataKey === "weight");
  const a = payload.find((p: any) => p.dataKey === "avg7");
  const date = payload[0]?.payload?.date;
  return (
    <div style={{
      background: "#0C0C18",
      border: "1px solid rgba(0,200,255,0.2)",
      borderRadius: 10,
      padding: "0.7rem 1rem",
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: "0.72rem",
      boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
    }}>
      <p style={{ color: C.muted, marginBottom: "0.4rem" }}>
        {date ? format(parseISO(date), "EEE, MMM d yyyy") : ""}
      </p>
      {w && <p style={{ color: C.accent, fontWeight: 500, fontSize: "0.88rem" }}>{w.value} kg</p>}
      {a && <p style={{ color: `${C.line}99`, marginTop: "0.2rem" }}>7d avg: {a.value} kg</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TrackerDashboard() {
  const { data: checkins = [], isLoading } = useTrackerCheckins(365);
  const { data: goal } = useTrackerGoal();
  const stats = useProgressStats();
  const [range, setRange] = useState<Range>("3M");

  const sorted = useMemo(() =>
    [...checkins].sort((a, b) => a.log_date.localeCompare(b.log_date)),
    [checkins]
  );

  // Build chart data with 7d rolling avg
  const chartData = useMemo(() =>
    sorted.map((c, i) => {
      const slice = sorted.slice(Math.max(0, i - 6), i + 1);
      const avg7 = +(slice.reduce((s, x) => s + x.weight, 0) / slice.length).toFixed(2);
      return { date: c.log_date, weight: c.weight, avg7 };
    }),
    [sorted]
  );

  // Filter by selected range
  const filteredData = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!days) return chartData;
    const cutoff = subDays(new Date(), days).toISOString().split("T")[0];
    return chartData.filter(d => d.date >= cutoff);
  }, [chartData, range]);

  const weights = filteredData.map(d => d.weight);
  const yMin = weights.length ? Math.floor(Math.min(...weights) - 1.5) : 0;
  const yMax = weights.length ? Math.ceil(Math.max(...weights) + 1.5) : 100;

  const latest  = sorted[sorted.length - 1];
  const last7   = sorted.slice(-7);
  const avg7    = last7.length ? +(last7.reduce((s, c) => s + c.weight, 0) / last7.length).toFixed(1) : null;
  const prev7   = sorted.slice(-14, -7);
  const avgPrev = prev7.length ? +(prev7.reduce((s, c) => s + c.weight, 0) / prev7.length).toFixed(1) : null;
  const weekChg = avg7 && avgPrev ? +(+avg7 - +avgPrev).toFixed(1) : null;

  if (isLoading) return (
    <div style={{ color: "rgba(221,232,237,0.3)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem", paddingTop: "4rem", textAlign: "center" }}>
      loading data...
    </div>
  );

  if (checkins.length === 0) return (
    <div>
      <div className="kt-page-header">
        <p className="kt-page-eyebrow">Overview</p>
        <h1 className="kt-page-title">Welcome to <em>KordaTracker</em></h1>
      </div>
      <div className="kt-card" style={{ textAlign: "center", padding: "4rem 2rem" }}>
        <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.5rem", marginBottom: "1rem" }}>No data yet.</p>
        <p style={{ color: "rgba(221,232,237,0.4)", fontSize: "0.9rem", marginBottom: "2rem" }}>Log your first check-in to start tracking your progress.</p>
        <Link to="/tracker/progress" className="kt-btn kt-btn-blue" style={{ textDecoration: "none", display: "inline-block" }}>
          Log first check-in →
        </Link>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="kt-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p className="kt-page-eyebrow">Overview</p>
          <h1 className="kt-page-title">Your <em>dashboard</em></h1>
        </div>
        <Link to="/tracker/progress" className="kt-btn kt-btn-blue" style={{ textDecoration: "none", marginTop: "0.5rem" }}>
          + Log today
        </Link>
      </div>

      {/* Stats row */}
      <div className="kt-grid-4" style={{ marginBottom: 2 }}>
        <StatCard
          label="Current weight"
          value={latest ? `${latest.weight} kg` : "—"}
          sub={avg7 ? `7d avg: ${avg7} kg` : undefined}
        />
        <StatCard
          label="Total lost"
          value={stats ? `${stats.totalLost > 0 ? "-" : "+"}${Math.abs(stats.totalLost)} kg` : "—"}
          sub={goal?.goal_weight ? `Goal: ${goal.goal_weight} kg` : undefined}
          color={stats && stats.totalLost > 0 ? C.green : C.red}
        />
        <StatCard
          label="Goal progress"
          value={stats ? `${stats.percentToGoal}%` : "—"}
          sub={stats?.daysToGoal ? `~${stats.daysToGoal} days left` : undefined}
        />
        <StatCard
          label="Streak"
          value={stats ? `${stats.currentStreak}d` : "—"}
          sub={weekChg !== null ? `${weekChg > 0 ? "+" : ""}${weekChg} kg this week` : `${checkins.length} total`}
          color={C.text}
        />
      </div>

      {/* Interactive weight chart */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: `2px solid rgba(0,200,255,0.18)`, padding: "1.5rem", marginBottom: 2, borderRadius: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted, marginBottom: "0.3rem" }}>Weight trend</p>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: C.dim }}>
              {goal?.goal_weight ? `Goal: ${goal.goal_weight} kg  ·  ` : ""}Raw data + 7-day rolling average
            </p>
          </div>

          {/* Range selector */}
          <div style={{ display: "flex", background: "#080810", border: "1px solid rgba(0,200,255,0.1)", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: "0.65rem",
                  letterSpacing: "0.06em",
                  padding: "0.4rem 0.8rem",
                  background: range === r ? "#00C8FF" : "transparent",
                  color: range === r ? "#080810" : "rgba(221,232,237,0.3)",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: range === r ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {filteredData.length < 2 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: C.muted, fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem" }}>
            Not enough data for this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={filteredData} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#5ab4d4" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#5ab4d4" stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="date"
                tickFormatter={d => { try { return format(parseISO(d), range === "1W" ? "EEE d" : "MMM d"); } catch { return ""; } }}
                tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: "rgba(221,232,237,0.22)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={v => `${v}`}
                tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: "rgba(221,232,237,0.22)" }}
                axisLine={false}
                tickLine={false}
                tickCount={5}
                width={32}
              />
              <Tooltip content={<WeightTooltip />} cursor={{ stroke: "rgba(0,200,255,0.12)", strokeWidth: 1 }} />

              {goal?.goal_weight && (
                <ReferenceLine
                  y={goal.goal_weight}
                  stroke="rgba(90,212,160,0.3)"
                  strokeDasharray="6 4"
                  strokeWidth={1}
                  label={{
                    value: `goal: ${goal.goal_weight} kg`,
                    position: "insideTopRight",
                    fill: "rgba(90,212,160,0.45)",
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 9,
                  }}
                />
              )}

              {/* Area fill under the avg line */}
              <Area
                type="monotone"
                dataKey="avg7"
                fill="url(#areaGrad)"
                stroke="none"
                dot={false}
                activeDot={false}
              />

              {/* Raw weight — dashed, with interactive dots */}
              <Line
                type="monotone"
                dataKey="weight"
                stroke="rgba(90,180,212,0.3)"
                strokeWidth={1}
                strokeDasharray="3 4"
                dot={{ r: 2.5, fill: "rgba(90,180,212,0.55)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#00C8FF", strokeWidth: 2, stroke: "rgba(0,200,255,0.3)" }}
              />

              {/* 7-day rolling avg — solid */}
              <Line
                type="monotone"
                dataKey="avg7"
                stroke="#5ab4d4"
                strokeWidth={2}
                dot={false}
                activeDot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {/* Legend */}
        <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px solid rgba(0,200,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="rgba(90,180,212,0.4)" strokeWidth="1.5" strokeDasharray="3 3" /></svg>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(221,232,237,0.3)", letterSpacing: "0.05em" }}>Raw</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="#5ab4d4" strokeWidth="2" /></svg>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(221,232,237,0.3)", letterSpacing: "0.05em" }}>7d avg</span>
          </div>
          {goal?.goal_weight && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="rgba(90,212,160,0.4)" strokeWidth="1.5" strokeDasharray="5 3" /></svg>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(221,232,237,0.3)", letterSpacing: "0.05em" }}>Goal</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: recent check-ins + quick actions */}
      <div className="kt-grid-2">
        {/* Recent */}
        <div className="kt-card">
          <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Recent check-ins</p>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {sorted.slice(-6).reverse().map((c, i, arr) => {
              const prev = arr[i + 1];
              const delta = prev ? +(c.weight - prev.weight).toFixed(1) : null;
              return (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.55rem 0", borderBottom: "1px solid rgba(90,180,212,0.06)" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "rgba(221,232,237,0.3)", fontSize: "0.68rem" }}>
                    {format(parseISO(c.log_date), "EEE, MMM d")}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                    {delta !== null && (
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.68rem", color: delta <= 0 ? C.green : C.red }}>
                        {delta > 0 ? "+" : ""}{delta}
                      </span>
                    )}
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: C.accent, fontWeight: 500, fontSize: "0.82rem" }}>
                      {c.weight} kg
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <Link to="/tracker/progress" style={{ display: "block", marginTop: "1rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(90,180,212,0.4)", textDecoration: "none", letterSpacing: "0.1em" }}>
            View all →
          </Link>
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { to: "/tracker/progress", label: "Log check-in",    sub: "Record weight & measurements" },
            { to: "/tracker/journal",  label: "Daily journal",   sub: "Mood, energy, wins & struggles" },
            { to: "/tracker/photos",   label: "Progress photos", sub: "Front, side, or back" },
            { to: "/tracker/analysis", label: "Deep analysis",   sub: "Trends, projections & insights" },
          ].map(item => (
            <Link key={item.to} to={item.to} style={{ textDecoration: "none", flex: 1 }}>
              <div
                className="kt-card"
                style={{ cursor: "pointer", transition: "all 0.15s", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderTopColor = "rgba(0,200,255,0.35)"; (e.currentTarget as HTMLElement).style.background = "#11121e"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderTopColor = "rgba(0,200,255,0.18)"; (e.currentTarget as HTMLElement).style.background = C.card; }}
              >
                <div>
                  <p style={{ fontSize: "0.84rem", fontWeight: 500, color: C.text, marginBottom: "0.15rem" }}>{item.label}</p>
                  <p style={{ fontSize: "0.7rem", color: "rgba(221,232,237,0.28)" }}>{item.sub}</p>
                </div>
                <span style={{ color: "rgba(90,180,212,0.3)", fontSize: "0.9rem", flexShrink: 0 }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
