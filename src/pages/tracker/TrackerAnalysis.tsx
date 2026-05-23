import React, { useState, useMemo } from "react";
import {
  ComposedChart, LineChart, Line, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { useTrackerCheckins, useTrackerGoal, useProgressStats } from "@/features/tracker/hooks/useTrackerCheckins";
import { useTrackerPhotos } from "@/features/tracker/hooks/useTrackerJournal";
import type { TrackerPhoto } from "@/features/tracker/types";

const C = {
  accent: "#00C8FF",
  line:   "#5ab4d4",
  green:  "#5ad4a0",
  red:    "#d4705a",
  text:   "#e8f0f4",
  muted:  "rgba(232,240,244,0.55)",
  dim:    "rgba(232,240,244,0.32)",
};

// ── Tooltip factory ────────────────────────────────────────────────────────────

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
      <div style={{ background: "#0C0C18", border: "1px solid rgba(0,200,255,0.2)", borderRadius: 10, padding: "0.75rem 1rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", boxShadow: "0 12px 40px rgba(0,0,0,0.6)", maxWidth: 320, pointerEvents: "none" }}>
        <p style={{ color: C.muted, marginBottom: "0.4rem", fontSize: "0.68rem" }}>{date ? format(parseISO(date), "EEE, MMM d yyyy") : ""}</p>
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

const M_COLORS: Record<string, string> = {
  waist:    "#d4705a",
  chest:    "#5ab4d4",
  hips:     "#b45ad4",
  arms:     "#d4c45a",
  thighs:   "#5ad4a0",
  body_fat: "#d4905a",
};
const M_LABELS: Record<string, string> = {
  waist: "Waist", chest: "Chest", hips: "Hips", arms: "Arms", thighs: "Thighs", body_fat: "Body fat",
};

function MeasureTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const date = payload[0]?.payload?.date;
  return (
    <div style={{ background: "#0C0C18", border: "1px solid rgba(0,200,255,0.2)", borderRadius: 10, padding: "0.7rem 1rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", boxShadow: "0 12px 40px rgba(0,0,0,0.6)", pointerEvents: "none" }}>
      <p style={{ color: "rgba(221,232,237,0.32)", marginBottom: "0.35rem", fontSize: "0.68rem" }}>
        {date ? format(parseISO(date), "EEE, MMM d yyyy") : ""}
      </p>
      {payload.map((p: any) => p.value != null && (
        <p key={p.dataKey} style={{ color: M_COLORS[p.dataKey] ?? "#dde8ed", marginTop: "0.15rem" }}>
          {M_LABELS[p.dataKey] ?? p.dataKey}: {p.value}{p.dataKey === "body_fat" ? "%" : " cm"}
        </p>
      ))}
    </div>
  );
}

export default function TrackerAnalysis() {
  const { data: checkins = [] } = useTrackerCheckins(365);
  const { data: goal }          = useTrackerGoal();
  const stats                   = useProgressStats();
  const { data: photos = [] }   = useTrackerPhotos();
  const [lightboxPhotos, setLightboxPhotos] = useState<TrackerPhoto[] | null>(null);

  const sorted = [...checkins].sort((a, b) => a.log_date.localeCompare(b.log_date));

  const photosByDate = useMemo(() =>
    photos.reduce<Record<string, TrackerPhoto[]>>((acc, p) => {
      acc[p.log_date] = acc[p.log_date] ?? [];
      acc[p.log_date].push(p);
      return acc;
    }, {}),
    [photos]
  );

  const startWeight = sorted[0]?.weight ?? null;

  const weeklyData = buildWeekly(sorted);
  const firstDate  = sorted[0]?.log_date;
  const lastDate   = sorted[sorted.length - 1]?.log_date;
  const totalDays  = firstDate && lastDate
    ? Math.round((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86400000) + 1
    : 0;
  const adherence = totalDays > 0 ? Math.round((sorted.length / totalDays) * 100) : 0;

  const TooltipContent = useMemo(
    () => makeTooltip(photosByDate, startWeight),
    [photosByDate, startWeight]
  );

  // Measurement chart data — include any checkin that has at least one measurement
  const measureData = useMemo(() =>
    sorted
      .filter(c => c.waist || c.chest || c.hips || c.arms || c.thighs || c.body_fat)
      .map(c => ({
        date:     c.log_date,
        waist:    c.waist    ?? undefined,
        chest:    c.chest    ?? undefined,
        hips:     c.hips     ?? undefined,
        arms:     c.arms     ?? undefined,
        thighs:   c.thighs   ?? undefined,
        body_fat: c.body_fat ?? undefined,
      })),
    [sorted]
  );

  // Which measurements have enough data to chart
  const activeMeasures = useMemo(() =>
    (["waist","chest","hips","arms","thighs"] as const).filter(k =>
      measureData.filter(d => d[k] != null).length >= 2
    ),
    [measureData]
  );

  const hasBf = measureData.filter(d => d.body_fat != null).length >= 2;

  // Y domain for measurement chart (cm only)
  const measureVals = activeMeasures.flatMap(k => measureData.map(d => d[k]).filter(Boolean) as number[]);
  const mYMin = measureVals.length ? Math.floor(Math.min(...measureVals) - 2) : 0;
  const mYMax = measureVals.length ? Math.ceil(Math.max(...measureVals)  + 2) : 120;

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

        <div className="kt-chart-wrap" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 0, left: -8 }}
              onClick={(data: any) => {
                if (!data?.activePayload?.[0]) return;
                const date = data.activePayload[0].payload?.date;
                if (!date) return;
                const dayPhotos = photosByDate[date] ?? [];
                if (dayPhotos.length > 0) setLightboxPhotos(dayPhotos);
              }}
            >
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
              <Tooltip content={TooltipContent} cursor={{ stroke: "rgba(0,200,255,0.12)", strokeWidth: 1 }} />

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
              <Line
                type="monotone"
                dataKey="weight"
                stroke="rgba(90,180,212,0.28)"
                strokeWidth={1}
                strokeDasharray="3 4"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (cx == null || cy == null) return <g key={`dot-${payload.date}`} />;
                  const hasPhotos = (photosByDate[payload.date]?.length ?? 0) > 0;
                  return hasPhotos ? (
                    <g key={`dot-${payload.date}`} style={{ cursor: "pointer" }}>
                      <circle cx={cx} cy={cy} r={8} fill="rgba(0,200,255,0.1)" strokeWidth={0} />
                      <circle cx={cx} cy={cy} r={4} fill="#00C8FF" strokeWidth={1.5} stroke="rgba(0,200,255,0.5)" />
                    </g>
                  ) : (
                    <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={2} fill="rgba(90,180,212,0.45)" strokeWidth={0} />
                  );
                }}
                activeDot={{ r: 5, fill: "#00C8FF", strokeWidth: 2, stroke: "rgba(0,200,255,0.3)" }}
              />
              <Line type="monotone" dataKey="avg7" stroke="#5ab4d4" strokeWidth={2} dot={false} activeDot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {photos.length > 0 && (
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.12em", color: "rgba(221,232,237,0.2)", marginTop: "0.6rem" }}>
            cyan dots = days with photos · click to open
          </p>
        )}
      </div>

      {/* Weekly breakdown */}
      <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
        <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Weekly breakdown</p>

        {/* Mobile card list */}
        <div className="kt-mobile-only">
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
        </div>

        {/* Desktop table */}
        <div className="kt-desktop-only">
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
        </div>
      </div>

      {/* Measurement trends chart */}
      {(activeMeasures.length >= 1 || hasBf) && (
        <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
          <p className="kt-card-label" style={{ marginBottom: "0.3rem" }}>Measurement trends</p>
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.68rem", color: C.dim, marginBottom: "1.25rem" }}>
            Body measurements over time (cm){hasBf ? " · body fat on separate scale" : ""}
          </p>

          {activeMeasures.length >= 1 && (
            <div className="kt-chart-wrap" style={{ height: 220, marginBottom: hasBf ? "1.5rem" : 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={measureData} margin={{ top: 4, right: 16, bottom: 0, left: -8 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={d => { try { return format(parseISO(d), "MMM d"); } catch { return ""; } }}
                    tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: "rgba(221,232,237,0.22)" }}
                    axisLine={false} tickLine={false} interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[mYMin, mYMax]}
                    tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: "rgba(221,232,237,0.22)" }}
                    axisLine={false} tickLine={false} tickCount={5} width={32}
                    tickFormatter={v => `${v}`}
                  />
                  <Tooltip content={<MeasureTooltip />} cursor={{ stroke: "rgba(0,200,255,0.12)", strokeWidth: 1 }} />
                  {activeMeasures.map(k => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={M_COLORS[k]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: M_COLORS[k], strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: M_COLORS[k], strokeWidth: 2, stroke: `${M_COLORS[k]}55` }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Legend */}
          {activeMeasures.length >= 1 && (
            <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap", marginTop: activeMeasures.length >= 1 ? "0.75rem" : 0, paddingTop: "0.75rem", borderTop: "1px solid rgba(0,200,255,0.05)" }}>
              {activeMeasures.map(k => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ width: 20, height: 2, background: M_COLORS[k], display: "inline-block", borderRadius: 2 }} />
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(221,232,237,0.35)", letterSpacing: "0.05em" }}>{M_LABELS[k]}</span>
                </div>
              ))}
            </div>
          )}

          {/* Body fat — separate mini stat if charted alone */}
          {hasBf && (
            <div style={{ marginTop: activeMeasures.length >= 1 ? "1.25rem" : 0 }}>
              {activeMeasures.length >= 1 && <div style={{ borderTop: "1px solid rgba(0,200,255,0.06)", marginBottom: "1rem" }} />}
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                {[
                  { label: "Body fat start", val: measureData.find(d => d.body_fat != null)?.body_fat },
                  { label: "Body fat now",   val: [...measureData].reverse().find(d => d.body_fat != null)?.body_fat },
                ].map(({ label, val }) => val != null && (
                  <div key={label}>
                    <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(221,232,237,0.25)", marginBottom: "0.2rem" }}>{label}</p>
                    <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1rem", color: M_COLORS.body_fat }}>{val}%</p>
                  </div>
                ))}
                {(() => {
                  const first = measureData.find(d => d.body_fat != null)?.body_fat;
                  const last  = [...measureData].reverse().find(d => d.body_fat != null)?.body_fat;
                  if (!first || !last) return null;
                  const delta = +(last - first).toFixed(1);
                  return (
                    <div key="delta">
                      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(221,232,237,0.25)", marginBottom: "0.2rem" }}>Change</p>
                      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1rem", color: delta < 0 ? C.green : C.red }}>{delta > 0 ? "+" : ""}{delta}%</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
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
