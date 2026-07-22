import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, subDays, addDays } from "date-fns";
import { useTrackerCheckins, useTrackerGoal, useProgressStats } from "@/features/tracker/hooks/useTrackerCheckins";
import { useTrackerPhotos, useTrackerJournal } from "@/features/tracker/hooks/useTrackerJournal";
import WeightTrendChart from "@/features/tracker/components/WeightTrendChart";
import type { TrackerPhoto } from "@/features/tracker/types";

type Range = "1W" | "1M" | "3M" | "All";
const RANGES: Range[] = ["1W", "1M", "3M", "All"];
const RANGE_DAYS: Record<Range, number | null> = { "1W": 7, "1M": 30, "3M": 90, "All": null };

const C = {
  accent:  "var(--kt-accent)",
  line:    "var(--kt-accent)",
  green:   "var(--kt-green)",
  red:     "var(--kt-red)",
  text:    "var(--kt-text)",
  muted:   "var(--kt-muted)",
  dim:     "var(--kt-dim)",
  card:    "var(--kt-surface)",
  border:  "var(--kt-border)",
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

  // Filter by selected range
  const filteredData = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!days) return sorted;
    const cutoff = subDays(new Date(), days).toISOString().split("T")[0];
    return sorted.filter(d => d.log_date >= cutoff);
  }, [sorted, range]);

  // 7-day rolling average per date, computed over the full history so the
  // start of a filtered range still has real preceding days to average over.
  const avg7ByDate = useMemo(() => {
    const map: Record<string, number> = {};
    sorted.forEach((c, i) => {
      const slice = sorted.slice(Math.max(0, i - 6), i + 1);
      map[c.log_date] = +(slice.reduce((s, x) => s + x.weight, 0) / slice.length).toFixed(2);
    });
    return map;
  }, [sorted]);

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

  if (isLoading) return (
    <div style={{ color: "var(--kt-dim)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem", paddingTop: "4rem", textAlign: "center" }}>
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
        <p style={{ color: "var(--kt-muted)", fontSize: "0.9rem", marginBottom: "2rem" }}>Log your first check-in to start tracking your progress.</p>
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
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--kt-accent)", opacity: 0.6, marginBottom: "1rem", textAlign: "center" }}>
              {lightboxPhotos[0]?.log_date}{lightboxPhotos[0]?.weight_at ? ` · ${lightboxPhotos[0].weight_at} kg` : ""}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
              {lightboxPhotos.map(photo => (
                <div key={photo.id} style={{ flex: "1 1 140px", maxWidth: "30vw", minWidth: 120 }}>
                  <img src={photo.url} alt={photo.angle} style={{ width: "100%", maxHeight: "70vh", objectFit: "cover", borderRadius: 4, display: "block" }} />
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", textTransform: "capitalize", color: "var(--kt-dim)", textAlign: "center", marginTop: "0.4rem" }}>
                    {photo.angle}
                  </p>
                </div>
              ))}
            </div>
            <button onClick={() => setLightboxPhotos(null)} style={{ display: "block", margin: "1.5rem auto 0", background: "none", border: "1px solid var(--kt-border)", color: "var(--kt-dim)", cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.1em", padding: "0.5rem 1.5rem" }}>
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
      <div className="kt-dashboard-grid">

        {/* ── LEFT: stats + chart + recent check-ins ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>

          {/* Stats row */}
          <div className="kt-grid-4">
            <StatCard label="Current weight" value={latest ? `${latest.weight} kg` : "—"} sub={avg7 ? `7d avg: ${avg7} kg` : undefined} />
            <StatCard label="Total lost" value={stats ? `${stats.totalLost > 0 ? "-" : "+"}${Math.abs(stats.totalLost)} kg` : "—"} sub={goal?.goal_weight ? `Goal: ${goal.goal_weight} kg` : undefined} color={stats && stats.totalLost > 0 ? C.green : C.red} />
            <StatCard label="Goal progress" value={stats ? `${stats.percentToGoal}%` : "—"} sub={stats?.daysToGoal ? `~${stats.daysToGoal} days left` : undefined} />
            <StatCard label="Streak" value={stats ? `${stats.currentStreak}d` : "—"} sub={weekChg !== null ? `${weekChg > 0 ? "+" : ""}${weekChg} kg this week` : `${checkins.length} total`} color={C.text} />
          </div>

          {/* Chart */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: "1.5rem", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted, marginBottom: "0.3rem" }}>Weight trend</p>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: C.dim }}>
                  {goal?.goal_weight ? `Goal: ${goal.goal_weight} kg` : "No goal set"}
                </p>
              </div>
              <div style={{ display: "flex", background: "var(--kt-surface2)", border: "1px solid var(--kt-border)", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                {RANGES.map(r => (
                  <button key={r} onClick={() => setRange(r)} style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.06em", padding: "0.4rem 0.8rem", background: range === r ? "var(--kt-accent)" : "transparent", color: range === r ? "var(--kt-bg)" : "var(--kt-muted)", border: "none", cursor: "pointer", fontWeight: range === r ? 600 : 400, transition: "all 0.15s" }}>{r}</button>
                ))}
              </div>
            </div>

            <WeightTrendChart
              points={filteredData.map(c => ({ date: c.log_date, weight: c.weight, avg7: avg7ByDate[c.log_date] }))}
              projected={range === "All" || range === "3M" ? projectedPoints : []}
              goal={goal?.goal_weight}
              photosByDate={photosByDate}
              height={220}
              onDotClick={date => {
                const dayPhotos = photosByDate[date] ?? [];
                if (dayPhotos.length > 0) setLightboxPhotos(dayPhotos);
              }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px solid var(--kt-border)" }}>
              <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", color: "var(--kt-dim)" }}>
                {filteredData.some(c => (photosByDate[c.log_date]?.length ?? 0) > 0) ? "filled dots = photos" : ""}
              </p>
              <Link to="/tracker/graph" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "var(--kt-accent)", opacity: 0.75, textDecoration: "none", letterSpacing: "0.06em" }}>Full graph →</Link>
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
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.55rem 0", borderBottom: "1px solid var(--kt-border2)" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "var(--kt-dim)", fontSize: "0.68rem" }}>{format(parseISO(c.log_date), "EEE, MMM d")}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                      {delta !== null && <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.68rem", color: delta <= 0 ? C.green : C.red }}>{delta > 0 ? "+" : ""}{delta}</span>}
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: C.accent, fontWeight: 500, fontSize: "0.82rem" }}>{c.weight} kg</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <Link to="/tracker/progress" style={{ display: "block", marginTop: "1rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "var(--kt-accent)", opacity: 0.7, textDecoration: "none", letterSpacing: "0.1em" }}>View all →</Link>
          </div>
        </div>

        {/* ── RIGHT PANEL: unified sidebar ── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* AI weekly summary */}
          <div style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: aiSummary ? "0.85rem" : "0.5rem" }}>
              <p className="kt-card-label" style={{ marginBottom: 0 }}>Weekly summary</p>
              <button onClick={generateSummary} disabled={aiLoading}
                style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.56rem", letterSpacing: "0.08em", padding: "0.25rem 0.6rem", border: "1px solid rgba(0,200,255,0.25)", background: "transparent", color: "#00C8FF", cursor: aiLoading ? "wait" : "pointer", opacity: aiLoading ? 0.6 : 1, whiteSpace: "nowrap" }}>
                {aiLoading ? "generating..." : aiSummary ? "↺" : "✦ Generate"}
              </button>
            </div>
            {aiError && <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", color: C.red }}>{aiError}</p>}
            {aiSummary ? (
              <p style={{ fontSize: "0.76rem", color: "var(--kt-muted)", lineHeight: 1.75 }}>{aiSummary}</p>
            ) : !aiLoading && (
              <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", color: "var(--kt-dim)", lineHeight: 1.65 }}>
                AI coach recap of your last 7 days — trend, patterns, one action.
              </p>
            )}
          </div>

          <div style={{ height: 1, background: "var(--kt-border)", margin: "0 1.25rem" }} />

          {/* Weekly pace */}
          <div style={{ padding: "1.25rem" }}>
            <p className="kt-card-label" style={{ marginBottom: "0.75rem" }}>Weekly pace</p>
            {paceKgPerWeek !== null ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginBottom: "0.5rem" }}>
                  <span style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.8rem", fontWeight: 400, color: paceColor, lineHeight: 1 }}>
                    {paceKgPerWeek > 0 ? "+" : ""}{paceKgPerWeek}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: C.muted }}>kg/wk</span>
                </div>
                {targetPace !== null && (
                  <>
                    <div style={{ background: "rgba(255,255,255,0.05)", height: 3, borderRadius: 2, overflow: "hidden", marginBottom: "0.5rem" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, (Math.abs(paceKgPerWeek) / Math.abs(targetPace)) * 100)}%`, background: paceColor, borderRadius: 2, transition: "width 0.6s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", color: paceColor }}>
                        {paceStatus === "ahead" ? "↑ Ahead" : paceStatus === "behind" ? "↓ Behind" : "● On track"}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", color: C.dim }}>target: −{Math.abs(targetPace)} kg/wk</span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p style={{ color: C.dim, fontSize: "0.75rem", fontFamily: "'IBM Plex Mono',monospace" }}>Need more data</p>
            )}
          </div>

          <div style={{ height: 1, background: "var(--kt-border)", margin: "0 1.25rem" }} />

          {/* Latest photo */}
          <div style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <p className="kt-card-label" style={{ marginBottom: 0 }}>Latest photo</p>
              {latestFrontPhoto && <Link to="/tracker/photos" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.56rem", color: "var(--kt-accent)", opacity: 0.7, textDecoration: "none", letterSpacing: "0.06em" }}>all photos →</Link>}
            </div>
            {latestFrontPhoto ? (
              <>
                <div style={{ overflow: "hidden", cursor: "pointer", marginBottom: "0.6rem", borderRadius: 2 }}
                  onClick={() => setLightboxPhotos(photosByDate[latestFrontPhoto.log_date] ?? [latestFrontPhoto])}>
                  <img src={latestFrontPhoto.url} alt="latest front" style={{ width: "100%", maxHeight: 240, objectFit: "cover", objectPosition: "top", display: "block" }} />
                </div>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", color: C.dim }}>
                  {format(parseISO(latestFrontPhoto.log_date), "d MMM yyyy")}{latestFrontPhoto.weight_at ? ` · ${latestFrontPhoto.weight_at} kg` : ""}
                </p>
              </>
            ) : (
              <Link to="/tracker/photos" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "var(--kt-accent)", opacity: 0.7, textDecoration: "none" }}>Add first photo →</Link>
            )}
          </div>

          <div style={{ height: 1, background: "var(--kt-border)", margin: "0 1.25rem" }} />

          {/* Personal records */}
          {records && (
            <div style={{ padding: "1.25rem" }}>
              <p className="kt-card-label" style={{ marginBottom: "0.75rem" }}>Records</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.55rem", color: "var(--kt-dim)", letterSpacing: "0.1em", marginBottom: "0.2rem" }}>LOWEST</p>
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.88rem", fontWeight: 500, color: C.accent }}>{records.lowestWeight} kg</p>
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.55rem", color: "var(--kt-dim)" }}>{format(parseISO(records.lowestDate), "d MMM")}</p>
                </div>
                <div>
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.55rem", color: "var(--kt-dim)", letterSpacing: "0.1em", marginBottom: "0.2rem" }}>BEST WEEK</p>
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.88rem", fontWeight: 500, color: records.bestWeek7 > 0 ? C.green : C.dim }}>{records.bestWeek7 > 0 ? `−${records.bestWeek7} kg` : "—"}</p>
                </div>
                <div>
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.55rem", color: "var(--kt-dim)", letterSpacing: "0.1em", marginBottom: "0.2rem" }}>BEST DROP</p>
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.88rem", fontWeight: 500, color: records.biggestDrop > 0 ? C.green : C.dim }}>{records.biggestDrop > 0 ? `−${records.biggestDrop} kg` : "—"}</p>
                </div>
                <div>
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.55rem", color: "var(--kt-dim)", letterSpacing: "0.1em", marginBottom: "0.2rem" }}>TOTAL LOGS</p>
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.88rem", fontWeight: 500, color: C.text }}>{sorted.length}</p>
                </div>
              </div>
            </div>
          )}

          <div style={{ height: 1, background: "var(--kt-border)", margin: "0 1.25rem" }} />

          {/* Quick nav */}
          <div style={{ padding: "0.5rem 0" }}>
            {[
              { to: "/tracker/progress", label: "Log check-in" },
              { to: "/tracker/graph",    label: "Weight graph" },
              { to: "/tracker/journal",  label: "Daily journal" },
              { to: "/tracker/photos",   label: "Progress photos" },
              { to: "/tracker/analysis", label: "Deep analysis" },
            ].map((item, i, arr) => (
              <Link key={item.to} to={item.to} style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 1.25rem", borderBottom: i < arr.length - 1 ? "1px solid var(--kt-border)" : "none", transition: "background 0.12s" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--kt-hover)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                <span style={{ fontSize: "0.8rem", color: "var(--kt-muted)", fontWeight: 400 }}>{item.label}</span>
                <span style={{ color: "var(--kt-accent)", opacity: 0.5, fontSize: "0.75rem" }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
