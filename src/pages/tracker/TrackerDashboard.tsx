import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, parseISO, subDays, addDays } from "date-fns";
import { useTrackerCheckins, useTrackerGoal, useProgressStats } from "@/features/tracker/hooks/useTrackerCheckins";
import { useTrackerPhotos, useTrackerJournal } from "@/features/tracker/hooks/useTrackerJournal";
import type { TrackerPhoto } from "@/features/tracker/types";

type Range = "1W" | "1M" | "3M" | "All";
const RANGES: Range[] = ["1W", "1M", "3M", "All"];
const RANGE_DAYS: Record<Range, number | null> = { "1W": 7, "1M": 30, "3M": 90, "All": null };

const C = {
  accent:  "#00C8FF",
  line:    "#5ab4d4",
  green:   "#5ad4a0",
  red:     "#d4705a",
  text:    "#e8f0f4",
  muted:   "rgba(232,240,244,0.55)",
  dim:     "rgba(232,240,244,0.32)",
  card:    "#0D0D16",
  border:  "rgba(0,200,255,0.07)",
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

// ── Tooltip factory ───────────────────────────────────────────────────────────

function makeTooltip(
  photosByDate: Record<string, TrackerPhoto[]>,
  startWeight: number | null
) {
  return function WeightTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const w = payload.find((p: any) => p.dataKey === "weight");
    const a = payload.find((p: any) => p.dataKey === "avg7");
    const date = payload[0]?.payload?.date;
    const dayPhotos = date ? (photosByDate[date] ?? []) : [];
    const pctLoss = startWeight && w?.value != null
      ? +((startWeight - w.value) / startWeight * 100).toFixed(1)
      : null;

    return (
      <div style={{
        background: "#0C0C18",
        border: "1px solid rgba(0,200,255,0.2)",
        borderRadius: 10,
        padding: "0.75rem 1rem",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "0.72rem",
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
        maxWidth: 320,
        pointerEvents: "none",
      }}>
        <p style={{ color: C.muted, marginBottom: "0.4rem", fontSize: "0.68rem" }}>
          {date ? format(parseISO(date), "EEE, MMM d yyyy") : ""}
        </p>
        {w && <p style={{ color: C.accent, fontWeight: 500, fontSize: "0.9rem" }}>{w.value} kg</p>}
        {pctLoss !== null && (
          <p style={{ color: pctLoss > 0 ? C.green : C.red, fontSize: "0.7rem", marginTop: "0.15rem" }}>
            {pctLoss > 0 ? "−" : "+"}{Math.abs(pctLoss)}% from start
          </p>
        )}
        {a && <p style={{ color: "rgba(90,180,212,0.55)", marginTop: "0.2rem" }}>7d avg: {a.value} kg</p>}
        {dayPhotos.length > 0 && (
          <div style={{ marginTop: "0.65rem", paddingTop: "0.65rem", borderTop: "1px solid rgba(0,200,255,0.1)" }}>
            <p style={{ fontSize: "0.52rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(221,232,237,0.22)", marginBottom: "0.45rem" }}>
              photos · click dot to open
            </p>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              {dayPhotos.map(photo => (
                <div key={photo.id} style={{ position: "relative", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                  <img src={photo.url} alt={photo.angle} style={{ width: 54, height: 72, objectFit: "cover", display: "block" }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.6)", padding: "2px 0", textAlign: "center", fontSize: "0.46rem", textTransform: "capitalize", color: "rgba(221,232,237,0.7)" }}>
                    {photo.angle}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TrackerDashboard() {
  const { data: checkins = [], isLoading } = useTrackerCheckins(365);
  const { data: goal } = useTrackerGoal();
  const stats = useProgressStats();
  const { data: photos = [] } = useTrackerPhotos();
  const { data: journalEntries = [] } = useTrackerJournal(7);
  const [range, setRange] = useState<Range>("3M");
  const [lightboxPhotos, setLightboxPhotos] = useState<TrackerPhoto[] | null>(null);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const generateSummary = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const cutoff7 = subDays(new Date(), 7).toISOString().split("T")[0];
      const recentCheckins = checkins.filter(c => c.log_date >= cutoff7);
      const res = await fetch("/api/tracker/weekly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkins: recentCheckins, journal: journalEntries, goal }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { summary } = await res.json();
      setAiSummary(summary);
    } catch (e: any) {
      setAiError(e?.message ?? "Failed to generate summary");
    } finally {
      setAiLoading(false);
    }
  };

  const sorted = useMemo(() =>
    [...checkins].sort((a, b) => a.log_date.localeCompare(b.log_date)),
    [checkins]
  );

  const photosByDate = useMemo(() =>
    photos.reduce<Record<string, TrackerPhoto[]>>((acc, p) => {
      acc[p.log_date] = acc[p.log_date] ?? [];
      acc[p.log_date].push(p);
      return acc;
    }, {}),
    [photos]
  );

  const latestFrontPhoto = useMemo(() =>
    photos.filter(p => p.angle === "front").sort((a, b) => b.log_date.localeCompare(a.log_date))[0]
    ?? [...photos].sort((a, b) => b.log_date.localeCompare(a.log_date))[0]
    ?? null,
    [photos]
  );

  const projectedPoints = useMemo(() => {
    if (!paceKgPerWeek || paceKgPerWeek >= 0 || !latest || !goal?.goal_weight) return [];
    const out: { date: string; projected: number }[] = [];
    let w = latest.weight;
    const goalW = goal.goal_weight;
    for (let i = 1; i <= 53; i++) {
      const d = addDays(new Date(latest.log_date), i * 7).toISOString().split("T")[0];
      w = +(w + paceKgPerWeek).toFixed(2);
      if (w <= goalW) { out.push({ date: d, projected: goalW }); break; }
      out.push({ date: d, projected: w });
    }
    return out;
  }, [paceKgPerWeek, latest, goal]);

  const records = useMemo(() => {
    if (sorted.length < 2) return null;
    const lowestWeight = Math.min(...sorted.map(c => c.weight));
    const lowestDate = sorted.find(c => c.weight === lowestWeight)?.log_date ?? "";
    let biggestDrop = 0;
    for (let i = 1; i < sorted.length; i++) {
      const drop = +(sorted[i - 1].weight - sorted[i].weight).toFixed(1);
      if (drop > biggestDrop) biggestDrop = drop;
    }
    let bestWeek7 = 0;
    for (let i = 0; i < sorted.length; i++) {
      const cutStr = addDays(new Date(sorted[i].log_date), 7).toISOString().split("T")[0];
      const end = sorted.filter(c => c.log_date > sorted[i].log_date && c.log_date <= cutStr).slice(-1)[0];
      if (end) bestWeek7 = Math.max(bestWeek7, +(sorted[i].weight - end.weight).toFixed(1));
    }
    return { lowestWeight: +lowestWeight.toFixed(1), lowestDate, biggestDrop: +biggestDrop.toFixed(1), bestWeek7: +bestWeek7.toFixed(1) };
  }, [sorted]);

  const startWeight = sorted[0]?.weight ?? null;

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

  const combinedData = useMemo(() => {
    const hist = filteredData.map((d, i) => ({
      ...d,
      projected: i === filteredData.length - 1 && projectedPoints.length ? (d.weight as number | undefined) : undefined,
    }));
    if (!projectedPoints.length) return hist;
    return [...hist, ...projectedPoints.map(p => ({
      date: p.date, weight: undefined as number | undefined,
      avg7: undefined as number | undefined, projected: p.projected,
    }))];
  }, [filteredData, projectedPoints]);

  const weights = filteredData.map(d => d.weight);
  const yMin = weights.length ? Math.floor(Math.min(...weights) - 1.5) : 0;
  const yMax = weights.length ? Math.ceil(Math.max(...weights) + 1.5) : 100;

  const latest  = sorted[sorted.length - 1];
  const cutoff7d  = subDays(new Date(), 7).toISOString().split("T")[0];
  const cutoff14d = subDays(new Date(), 14).toISOString().split("T")[0];
  const last7   = sorted.filter(c => c.log_date >= cutoff7d);
  const prev7   = sorted.filter(c => c.log_date >= cutoff14d && c.log_date < cutoff7d);
  const avg7    = last7.length ? +(last7.reduce((s, c) => s + c.weight, 0) / last7.length).toFixed(1) : null;
  const avgPrev = prev7.length ? +(prev7.reduce((s, c) => s + c.weight, 0) / prev7.length).toFixed(1) : null;
  const weekChg = avg7 && avgPrev ? +(+avg7 - +avgPrev).toFixed(1) : null;

  // 30-day weekly pace
  const cutoff30 = subDays(new Date(), 30).toISOString().split("T")[0];
  const last30 = sorted.filter(c => c.log_date >= cutoff30);
  const paceKgPerWeek: number | null = last30.length >= 2
    ? +((last30[last30.length - 1].weight - last30[0].weight) /
        ((new Date(last30[last30.length - 1].log_date).getTime() -
          new Date(last30[0].log_date).getTime()) / (7 * 24 * 60 * 60 * 1000))
      ).toFixed(2)
    : null;
  const targetPace = goal?.weekly_target ? -Math.abs(goal.weekly_target) : null;
  const paceStatus: "ahead" | "on track" | "behind" | null =
    paceKgPerWeek !== null && targetPace !== null
      ? paceKgPerWeek < targetPace * 1.2 ? "ahead"
        : paceKgPerWeek < targetPace * 0.8 ? "on track"
        : "behind"
      : null;
  const paceColor = paceStatus === "ahead" ? C.green : paceStatus === "behind" ? C.red : C.accent;

  const TooltipContent = useMemo(
    () => makeTooltip(photosByDate, startWeight),
    [photosByDate, startWeight]
  );

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
      {/* Lightbox */}
      {lightboxPhotos && (
        <div
          onClick={() => setLightboxPhotos(null)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(7,9,11,0.96)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "1.5rem" }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto" }}>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(90,180,212,0.5)", marginBottom: "1rem", textAlign: "center" }}>
              {lightboxPhotos[0]?.log_date}{lightboxPhotos[0]?.weight_at ? ` · ${lightboxPhotos[0].weight_at} kg` : ""}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
              {lightboxPhotos.map(photo => (
                <div key={photo.id} style={{ flex: "1 1 140px", maxWidth: "30vw", minWidth: 120 }}>
                  <img src={photo.url} alt={photo.angle} style={{ width: "100%", maxHeight: "70vh", objectFit: "cover", borderRadius: 4, display: "block" }} />
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", textTransform: "capitalize", color: "rgba(221,232,237,0.35)", textAlign: "center", marginTop: "0.4rem" }}>
                    {photo.angle}
                  </p>
                </div>
              ))}
            </div>
            <button onClick={() => setLightboxPhotos(null)} style={{ display: "block", margin: "1.5rem auto 0", background: "none", border: "1px solid rgba(221,232,237,0.15)", color: "rgba(221,232,237,0.35)", cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.1em", padding: "0.5rem 1.5rem" }}>
              close ×
            </button>
          </div>
        </div>
      )}

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

      {/* 2-column dashboard: main content left, panel right */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 2, alignItems: "start" }}>

        {/* ── LEFT: stats + chart + recent check-ins ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>

          {/* Stats row */}
          <div className="kt-grid-4">
            <StatCard label="Current weight" value={latest ? `${latest.weight} kg` : "—"} sub={avg7 ? `7d avg: ${avg7} kg` : undefined} />
            <StatCard label="Total lost" value={stats ? `${stats.totalLost > 0 ? "-" : "+"}${Math.abs(stats.totalLost)} kg` : "—"} sub={goal?.goal_weight ? `Goal: ${goal.goal_weight} kg` : undefined} color={stats && stats.totalLost > 0 ? C.green : C.red} />
            <StatCard label="Goal progress" value={stats ? `${stats.percentToGoal}%` : "—"} sub={stats?.daysToGoal ? `~${stats.daysToGoal} days left` : undefined} />
            <StatCard label="Streak" value={stats ? `${stats.currentStreak}d` : "—"} sub={weekChg !== null ? `${weekChg > 0 ? "+" : ""}${weekChg} kg this week` : `${checkins.length} total`} color={C.text} />
          </div>

          {/* Chart */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: "2px solid rgba(0,200,255,0.18)", padding: "1.5rem", borderRadius: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted, marginBottom: "0.3rem" }}>Weight trend</p>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: C.dim }}>
                  {goal?.goal_weight ? `Goal: ${goal.goal_weight} kg  ·  ` : ""}Raw + 7-day avg
                  {filteredData.some(d => (photosByDate[d.date]?.length ?? 0) > 0) ? "  ·  cyan dots = photos" : ""}
                </p>
              </div>
              <div style={{ display: "flex", background: "#080810", border: "1px solid rgba(0,200,255,0.1)", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                {RANGES.map(r => (
                  <button key={r} onClick={() => setRange(r)} style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.06em", padding: "0.4rem 0.8rem", background: range === r ? "#00C8FF" : "transparent", color: range === r ? "#080810" : "rgba(221,232,237,0.3)", border: "none", cursor: "pointer", fontWeight: range === r ? 600 : 400, transition: "all 0.15s" }}>{r}</button>
                ))}
              </div>
            </div>
            {filteredData.length < 2 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: C.muted, fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem" }}>Not enough data for this range.</div>
            ) : (
              <div className="kt-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={combinedData} margin={{ top: 8, right: 12, bottom: 0, left: -8 }} onClick={(data: any) => { if (!data?.activePayload?.[0]) return; const date = data.activePayload[0].payload?.date; if (!date) return; const dayPhotos = photosByDate[date] ?? []; if (dayPhotos.length > 0) setLightboxPhotos(dayPhotos); }} style={{ cursor: "default" }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5ab4d4" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#5ab4d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tickFormatter={d => { try { return format(parseISO(d), range === "1W" ? "EEE d" : "MMM d"); } catch { return ""; } }} tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: "rgba(221,232,237,0.22)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[yMin, yMax]} tickFormatter={v => `${v}`} tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: "rgba(221,232,237,0.22)" }} axisLine={false} tickLine={false} tickCount={5} width={32} />
                    <Tooltip content={TooltipContent} cursor={{ stroke: "rgba(0,200,255,0.12)", strokeWidth: 1 }} />
                    {goal?.goal_weight && <ReferenceLine y={goal.goal_weight} stroke="rgba(90,212,160,0.3)" strokeDasharray="6 4" strokeWidth={1} label={{ value: `goal: ${goal.goal_weight} kg`, position: "insideTopRight", fill: "rgba(90,212,160,0.45)", fontFamily: "'IBM Plex Mono',monospace", fontSize: 9 }} />}
                    <Area type="monotone" dataKey="avg7" fill="url(#areaGrad)" stroke="none" dot={false} activeDot={false} />
                    <Line type="monotone" dataKey="weight" stroke="rgba(90,180,212,0.3)" strokeWidth={1} strokeDasharray="3 4"
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (cx == null || cy == null) return <g key={`dot-${payload.date}`} />;
                        const hasPhotos = (photosByDate[payload.date]?.length ?? 0) > 0;
                        return hasPhotos ? (
                          <g key={`dot-${payload.date}`} style={{ cursor: "pointer" }}>
                            <circle cx={cx} cy={cy} r={8} fill="rgba(0,200,255,0.1)" strokeWidth={0} />
                            <circle cx={cx} cy={cy} r={4} fill="#00C8FF" strokeWidth={1.5} stroke="rgba(0,200,255,0.5)" />
                          </g>
                        ) : <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={2.5} fill="rgba(90,180,212,0.55)" strokeWidth={0} />;
                      }}
                      activeDot={{ r: 5, fill: "#00C8FF", strokeWidth: 2, stroke: "rgba(0,200,255,0.3)" }}
                    />
                    <Line type="monotone" dataKey="avg7" stroke="#5ab4d4" strokeWidth={2} dot={false} activeDot={false} />
                    {projectedPoints.length > 0 && (
                      <Line type="monotone" dataKey="projected" stroke="rgba(90,212,160,0.7)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} connectNulls={false} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px solid rgba(0,200,255,0.05)", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="rgba(90,180,212,0.4)" strokeWidth="1.5" strokeDasharray="3 3" /></svg><span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(221,232,237,0.3)", letterSpacing: "0.05em" }}>Raw</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="#5ab4d4" strokeWidth="2" /></svg><span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(221,232,237,0.3)", letterSpacing: "0.05em" }}>7d avg</span></div>
              {goal?.goal_weight && <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="rgba(90,212,160,0.4)" strokeWidth="1.5" strokeDasharray="5 3" /></svg><span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(221,232,237,0.3)", letterSpacing: "0.05em" }}>Goal</span></div>}
              {filteredData.some(d => (photosByDate[d.date]?.length ?? 0) > 0) && <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#00C8FF" /></svg><span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(221,232,237,0.3)", letterSpacing: "0.05em" }}>Photos</span></div>}
              {projectedPoints.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="rgba(90,212,160,0.7)" strokeWidth="1.5" strokeDasharray="4 3" /></svg><span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(221,232,237,0.3)", letterSpacing: "0.05em" }}>Projected</span></div>}
            </div>
          </div>

          {/* Recent check-ins */}
          <div className="kt-card">
            <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Recent check-ins</p>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {sorted.slice(-6).reverse().map((c, i, arr) => {
                const prev = arr[i + 1];
                const delta = prev ? +(c.weight - prev.weight).toFixed(1) : null;
                return (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.55rem 0", borderBottom: "1px solid rgba(90,180,212,0.06)" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "rgba(221,232,237,0.3)", fontSize: "0.68rem" }}>{format(parseISO(c.log_date), "EEE, MMM d")}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                      {delta !== null && <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.68rem", color: delta <= 0 ? C.green : C.red }}>{delta > 0 ? "+" : ""}{delta}</span>}
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: C.accent, fontWeight: 500, fontSize: "0.82rem" }}>{c.weight} kg</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <Link to="/tracker/progress" style={{ display: "block", marginTop: "1rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(90,180,212,0.4)", textDecoration: "none", letterSpacing: "0.1em" }}>View all →</Link>
          </div>
        </div>

        {/* ── RIGHT PANEL: weekly pace + photo + quick actions ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>

          {/* AI weekly summary */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: "2px solid rgba(0,200,255,0.18)", padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
              <p className="kt-card-label" style={{ marginBottom: 0 }}>Weekly summary</p>
              <button onClick={generateSummary} disabled={aiLoading}
                style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.08em", padding: "0.3rem 0.7rem", border: "1px solid rgba(0,200,255,0.25)", background: "transparent", color: "#00C8FF", cursor: aiLoading ? "wait" : "pointer", opacity: aiLoading ? 0.6 : 1, whiteSpace: "nowrap" }}>
                {aiLoading ? "..." : aiSummary ? "↺ Refresh" : "✦ Generate"}
              </button>
            </div>
            {aiError && <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: C.red }}>{aiError}</p>}
            {aiSummary ? (
              <p style={{ fontSize: "0.78rem", color: "rgba(232,240,244,0.6)", lineHeight: 1.7 }}>{aiSummary}</p>
            ) : !aiLoading && (
              <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(232,240,244,0.2)", lineHeight: 1.6 }}>
                Get a personalised AI coach recap of your last 7 days — weight trend, patterns, and one action for next week.
              </p>
            )}
          </div>

          {/* Weekly pace */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: "2px solid rgba(0,200,255,0.18)", padding: "1.25rem" }}>
            <p className="kt-card-label" style={{ marginBottom: "0.85rem" }}>Weekly pace</p>
            {paceKgPerWeek !== null ? (
              <>
                <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.75rem", fontWeight: 400, color: paceColor, marginBottom: "0.2rem", lineHeight: 1 }}>
                  {paceKgPerWeek > 0 ? "+" : ""}{paceKgPerWeek}
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem", color: C.muted, marginLeft: "0.3rem" }}>kg/wk</span>
                </p>
                {targetPace !== null && (
                  <>
                    <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: C.dim, marginBottom: "0.65rem" }}>Target: {Math.abs(targetPace)} kg/wk</p>
                    <div style={{ background: "rgba(255,255,255,0.05)", height: 3, borderRadius: 2, overflow: "hidden", marginBottom: "0.5rem" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, (Math.abs(paceKgPerWeek) / Math.abs(targetPace)) * 100)}%`, background: paceColor, borderRadius: 2, transition: "width 0.6s ease" }} />
                    </div>
                    <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: paceColor }}>
                      {paceStatus === "ahead" ? "↑ Ahead of target" : paceStatus === "behind" ? "↓ Behind target" : "● On track"}
                    </p>
                  </>
                )}
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.52rem", color: "rgba(221,232,237,0.18)", marginTop: "0.5rem", letterSpacing: "0.06em" }}>30-day trend</p>
              </>
            ) : (
              <p style={{ color: C.dim, fontSize: "0.78rem", fontFamily: "'IBM Plex Mono',monospace" }}>Not enough data</p>
            )}
          </div>

          {/* Latest front photo */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: "2px solid rgba(0,200,255,0.18)", padding: "1.25rem", display: "flex", flexDirection: "column" }}>
            <p className="kt-card-label" style={{ marginBottom: "0.85rem" }}>Latest photo</p>
            {latestFrontPhoto ? (
              <>
                <div style={{ overflow: "hidden", cursor: "pointer", marginBottom: "0.65rem", maxHeight: 260 }}
                  onClick={() => setLightboxPhotos(photosByDate[latestFrontPhoto.log_date] ?? [latestFrontPhoto])}>
                  <img src={latestFrontPhoto.url} alt="latest front" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", color: C.dim }}>
                    {format(parseISO(latestFrontPhoto.log_date), "d MMM yyyy")}{latestFrontPhoto.weight_at ? ` · ${latestFrontPhoto.weight_at} kg` : ""}
                  </span>
                  <Link to="/tracker/photos" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", color: "rgba(90,180,212,0.4)", textDecoration: "none" }}>all →</Link>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", minHeight: 100 }}>
                <p style={{ color: C.dim, fontSize: "0.78rem", fontFamily: "'IBM Plex Mono',monospace" }}>No photos yet</p>
                <Link to="/tracker/photos" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(90,180,212,0.5)", textDecoration: "none" }}>Add photo →</Link>
              </div>
            )}
          </div>

          {/* Personal records */}
          {records && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: "2px solid rgba(0,200,255,0.18)", padding: "1.25rem" }}>
              <p className="kt-card-label" style={{ marginBottom: "0.85rem" }}>Personal records</p>
              {[
                { label: "Lowest weight", value: `${records.lowestWeight} kg`, note: format(parseISO(records.lowestDate), "d MMM"), color: C.accent },
                { label: "Best week",     value: records.bestWeek7 > 0 ? `−${records.bestWeek7} kg` : "—", color: records.bestWeek7 > 0 ? C.green : C.dim },
                { label: "Best drop",     value: records.biggestDrop > 0 ? `−${records.biggestDrop} kg` : "—", color: records.biggestDrop > 0 ? C.green : C.dim },
                { label: "Total logs",    value: `${sorted.length}`, color: C.text },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.35rem 0", borderBottom: "1px solid rgba(90,180,212,0.05)" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: C.dim }}>{item.label}</span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem", fontWeight: 500, color: item.color }}>{item.value}</span>
                    {'note' in item && item.note && <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.55rem", color: "rgba(221,232,237,0.2)", marginLeft: "0.4rem" }}>{item.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick actions */}
          {[
            { to: "/tracker/progress", label: "Log check-in",    sub: "Record weight & measurements" },
            { to: "/tracker/journal",  label: "Daily journal",   sub: "Mood, energy, wins & struggles" },
            { to: "/tracker/photos",   label: "Progress photos", sub: "Front, side, or back" },
            { to: "/tracker/analysis", label: "Deep analysis",   sub: "Trends, projections & insights" },
          ].map(item => (
            <Link key={item.to} to={item.to} style={{ textDecoration: "none" }}>
              <div className="kt-card" style={{ cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1.1rem" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderTopColor = "rgba(0,200,255,0.35)"; (e.currentTarget as HTMLElement).style.background = "#11121e"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderTopColor = "rgba(0,200,255,0.18)"; (e.currentTarget as HTMLElement).style.background = C.card; }}>
                <div>
                  <p style={{ fontSize: "0.82rem", fontWeight: 500, color: C.text, marginBottom: "0.1rem" }}>{item.label}</p>
                  <p style={{ fontSize: "0.67rem", color: "rgba(221,232,237,0.28)" }}>{item.sub}</p>
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
