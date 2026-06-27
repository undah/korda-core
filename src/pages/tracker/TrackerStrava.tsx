import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import polylineLib from "@mapbox/polyline";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Activity, LogOut, Mountain, Heart, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, startOfWeek, isValid, subDays } from "date-fns";
import {
  useStravaToken, useStravaActivities, useConnectStrava,
  useDisconnectStrava, getStravaAuthUrl, StravaActivity,
} from "@/features/tracker/hooks/useStrava";
import { useTrackerCheckins } from "@/features/tracker/hooks/useTrackerCheckins";
import "leaflet/dist/leaflet.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDist(m: number) { return (m / 1000).toFixed(2) + " km"; }


function formatPace(mps: number) {
  if (!mps) return "–";
  const mpk = 1000 / mps / 60;
  const mins = Math.floor(mpk);
  const secs = Math.round((mpk - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")} /km`;
}

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function isRun(a: StravaActivity) {
  return ["Run", "TrailRun", "VirtualRun"].includes(a.sport_type ?? a.type);
}

// ── HR zone estimator ─────────────────────────────────────────────────────────

const HR_ZONES = [
  { id: 1, label: "Easy",      color: "#60a5fa", min: 0,    max: 0.60 },
  { id: 2, label: "Aerobic",   color: "#34d399", min: 0.60, max: 0.70 },
  { id: 3, label: "Tempo",     color: "#fbbf24", min: 0.70, max: 0.80 },
  { id: 4, label: "Threshold", color: "#f97316", min: 0.80, max: 0.90 },
  { id: 5, label: "VO2max",    color: "#ef4444", min: 0.90, max: 1.00 },
];

function erfApprox(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const r = 1 - p * Math.exp(-x * x);
  return x >= 0 ? r : -r;
}

function estimateZones(avgHR: number, maxHR: number) {
  const trueMax = maxHR / 0.93;
  const stdDev = Math.max((maxHR - avgHR) * 0.85, 5);
  const cdf = (x: number) => 0.5 * (1 + erfApprox((x - avgHR) / (stdDev * Math.SQRT2)));
  const raw = HR_ZONES.map(z => ({
    ...z,
    pct: Math.max(0, cdf(z.max * trueMax) - cdf(z.min * trueMax)),
  }));
  const total = raw.reduce((s, z) => s + z.pct, 0);
  return raw.map(z => ({ ...z, pct: total > 0 ? z.pct / total : 0 }));
}

function HRZoneBar({ avgHR, maxHR }: { avgHR: number; maxHR: number }) {
  const zones = estimateZones(avgHR, maxHR).filter(z => z.pct > 0.02);
  return (
    <div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.52rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(232,240,244,0.3)", marginBottom: "0.6rem" }}>
        HR Zones <span style={{ color: "rgba(232,240,244,0.18)", fontSize: "0.48rem" }}>(estimated)</span>
      </div>
      <div style={{ display: "flex", height: 7, borderRadius: 4, overflow: "hidden", gap: 2 }}>
        {zones.map(z => (
          <div key={z.id} style={{ flex: z.pct, background: z.color, opacity: 0.85 }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.85rem", marginTop: "0.55rem", flexWrap: "wrap" }}>
        {zones.map(z => (
          <div key={z.id} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: z.color }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.54rem", color: "rgba(232,240,244,0.4)" }}>
              {z.label} <span style={{ color: z.color, fontWeight: 600 }}>{Math.round(z.pct * 100)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Map auto-fit ──────────────────────────────────────────────────────────────

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) map.fitBounds(positions as any, { padding: [24, 24] });
  }, [positions, map]);
  return null;
}

// ── Stat cell ─────────────────────────────────────────────────────────────────

function Stat({ label, value, color = "rgba(232,240,244,0.8)" }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.52rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(232,240,244,0.38)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.73rem", color, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

// ── Activity card ─────────────────────────────────────────────────────────────

function ActivityCard({ activity, selected, weightKg, onClick }: {
  activity: StravaActivity;
  selected: boolean;
  weightKg: number | null;
  onClick: () => void;
}) {
  const date = isValid(parseISO(activity.start_date_local))
    ? format(parseISO(activity.start_date_local), "MMM d")
    : "";

  const badges = [
    activity.total_elevation_gain > 0 && `↑ ${Math.round(activity.total_elevation_gain)}m`,
    activity.average_heartrate != null && `♥ ${Math.round(activity.average_heartrate)} bpm`,
    weightKg && `${weightKg.toFixed(1)} kg`,
  ].filter(Boolean) as string[];

  return (
    <div
      onClick={onClick}
      style={{
        padding: "0.85rem 1rem",
        background: selected ? "rgba(252,76,2,0.06)" : "transparent",
        borderLeft: `2px solid ${selected ? "#FC4C02" : "rgba(0,200,255,0.12)"}`,
        borderBottom: "1px solid rgba(0,200,255,0.06)",
        cursor: "pointer",
        transition: "background 0.13s, border-color 0.13s",
        userSelect: "none",
      }}
    >
      {/* Name + date */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", fontWeight: 600, color: selected ? "#fff" : "#e8f0f4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {activity.name}
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.58rem", color: "rgba(232,240,244,0.3)", flexShrink: 0 }}>{date}</div>
      </div>

      {/* Key stats row */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "1rem" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.88rem", fontWeight: 700, color: "#FC4C02" }}>{formatDist(activity.distance)}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "rgba(232,240,244,0.6)" }}>{formatPace(activity.average_speed)}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "rgba(232,240,244,0.4)" }}>{formatDuration(activity.moving_time)}</span>
      </div>

      {/* Secondary badges */}
      {badges.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.45rem", flexWrap: "wrap" }}>
          {badges.map(b => (
            <span key={b} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.55rem", color: "rgba(232,240,244,0.3)", background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 4 }}>{b}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TrackerStrava() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"run" | "all">("run");
  const [aiRange, setAiRange] = useState<30 | 60 | 90>(30);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 768);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);

  const onDragStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = 0;
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  }, []);

  const onDragMove = useCallback((e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy < 0) return;
    dragCurrentY.current = dy;
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`;
  }, []);

  const onDragEnd = useCallback(() => {
    if (dragCurrentY.current > 100) {
      if (sheetRef.current) sheetRef.current.style.transition = "transform 0.3s cubic-bezier(0.32,0.72,0,1)";
      setSelectedId(null);
    } else {
      if (sheetRef.current) {
        sheetRef.current.style.transition = "transform 0.4s cubic-bezier(0.34, 1.28, 0.64, 1)";
        sheetRef.current.style.transform = "translateY(0)";
      }
    }
    dragCurrentY.current = 0;
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isMobile && selectedId) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobile, selectedId]);

  const { data: tokenRow, isLoading: tokenLoading } = useStravaToken();
  const { data: activities = [], isLoading: activitiesLoading, dataUpdatedAt } = useStravaActivities();
  const { data: checkins = [] } = useTrackerCheckins(500);
  const connectStrava   = useConnectStrava();
  const disconnectStrava = useDisconnectStrava();

  // OAuth callback handling
  useEffect(() => {
    const code  = searchParams.get("code");
    const error = searchParams.get("error");
    if (error) {
      toast.error("Strava authorization denied");
      navigate("/tracker/strava", { replace: true });
      return;
    }
    if (code && !tokenLoading && !tokenRow && !connectStrava.isPending) {
      connectStrava.mutate(code, {
        onSettled: () => navigate("/tracker/strava", { replace: true }),
      });
    }
  }, [searchParams, tokenRow, tokenLoading]);

  // Returns most recent weight on or before given date
  const getLatestWeight = useMemo(() => {
    const sorted = checkins
      .filter(c => c.weight)
      .map(c => ({ date: c.log_date, weight: c.weight as number }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return (date: string): number | null => {
      let result: number | null = null;
      for (const entry of sorted) {
        if (entry.date <= date) result = entry.weight;
        else break;
      }
      return result;
    };
  }, [checkins]);

  const filteredActivities = useMemo(() => {
    const list = filter === "run" ? activities.filter(isRun) : activities;
    return [...list].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  }, [activities, filter]);

  const selectedActivity = filteredActivities.find(a => a.id === selectedId) ?? null;

  // Decode polyline for map
  const routePositions = useMemo<[number, number][]>(() => {
    const poly = selectedActivity?.map?.summary_polyline;
    if (!poly) return [];
    try { return polylineLib.decode(poly) as [number, number][]; }
    catch { return []; }
  }, [selectedActivity]);

  // Weekly chart data (km + weight + pace)
  const chartData = useMemo(() => {
    const weeks: Record<string, { week: string; km: number; weightSum: number; weightN: number; distSum: number; timeSum: number }> = {};
    for (const a of (filter === "run" ? activities.filter(isRun) : activities)) {
      const d = parseISO(a.start_date_local);
      if (!isValid(d)) continue;
      const wk = format(startOfWeek(d, { weekStartsOn: 1 }), "MMM d");
      const dk = format(d, "yyyy-MM-dd");
      if (!weeks[wk]) weeks[wk] = { week: wk, km: 0, weightSum: 0, weightN: 0, distSum: 0, timeSum: 0 };
      weeks[wk].km += a.distance / 1000;
      weeks[wk].distSum += a.distance;
      weeks[wk].timeSum += a.moving_time;
      const w = getLatestWeight(dk);
      if (w) { weeks[wk].weightSum += w; weeks[wk].weightN++; }
    }
    return Object.values(weeks)
      .map(w => ({
        week: w.week,
        km: +w.km.toFixed(1),
        weight: w.weightN ? +(w.weightSum / w.weightN).toFixed(1) : null,
        pace: w.distSum > 0 ? +(1000 / (w.distSum / w.timeSum) / 60).toFixed(2) : null,
      }))
      .reverse()
      .slice(-20);
  }, [activities, filter, getLatestWeight]);

  // Aggregate stats
  const stats = useMemo(() => {
    const runs = activities.filter(isRun);
    return {
      count:    runs.length,
      totalKm:  runs.reduce((s, a) => s + a.distance, 0) / 1000,
      totalTime: runs.reduce((s, a) => s + a.moving_time, 0),
    };
  }, [activities]);

  // Body Efficiency Index: speed (m/s) / weight (kg) × 1000 — higher = more efficient
  const bodyEffData = useMemo(() => {
    return activities
      .filter(isRun)
      .filter(a => a.distance > 800 && a.average_speed > 0)
      .map(a => {
        const date = a.start_date_local?.slice(0, 10);
        if (!date) return null;
        const d = parseISO(date);
        if (!isValid(d)) return null;
        const weight = getLatestWeight(date);
        if (!weight) return null;
        return { date, label: format(d, "MMM d"), bei: +(a.average_speed / weight * 1000).toFixed(2), weight };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-40);
  }, [activities, getLatestWeight]);

  // Aerobic Efficiency Index: speed (m/s) / HR (bpm) × 1000 — higher = fitter
  const hrEffData = useMemo(() => {
    return activities
      .filter(isRun)
      .filter(a => a.distance > 800 && a.average_speed > 0 && a.average_heartrate != null)
      .map(a => {
        const date = a.start_date_local?.slice(0, 10);
        if (!date) return null;
        const d = parseISO(date);
        if (!isValid(d)) return null;
        return { date, label: format(d, "MMM d"), aei: +(a.average_speed / a.average_heartrate! * 1000).toFixed(2), hr: Math.round(a.average_heartrate!) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-40);
  }, [activities]);

  // Personal records
  const records = useMemo(() => {
    const runs = activities.filter(isRun).filter(a => a.distance > 500 && a.average_speed > 0);
    if (!runs.length) return null;
    const longest  = runs.reduce((b, a) => a.distance > b.distance ? a : b, runs[0]);
    const fastest  = runs.filter(a => a.distance > 1000).reduce((b, a) => a.average_speed > b.average_speed ? a : b, runs[0]);
    const mostElev = runs.reduce((b, a) => a.total_elevation_gain > b.total_elevation_gain ? a : b, runs[0]);
    const weekKm: Record<string, number> = {};
    for (const a of runs) {
      const d = parseISO(a.start_date_local);
      if (!isValid(d)) continue;
      const wk = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
      weekKm[wk] = (weekKm[wk] || 0) + a.distance / 1000;
    }
    const bestWeekKm = Math.max(...Object.values(weekKm));
    return { longest, fastest, mostElev, bestWeekKm };
  }, [activities]);

  // Training load: acute (7-day) vs chronic (28-day) daily km averages
  const trainingLoad = useMemo(() => {
    const runs = activities.filter(isRun);
    const dayKm: Record<string, number> = {};
    for (const a of runs) {
      const dk = a.start_date_local?.slice(0, 10);
      if (dk) dayKm[dk] = (dayKm[dk] || 0) + a.distance / 1000;
    }
    let acuteSum = 0, chronicSum = 0;
    const now = new Date();
    for (let i = 0; i < 28; i++) {
      const dk = format(subDays(now, i), "yyyy-MM-dd");
      const km = dayKm[dk] || 0;
      if (i < 7) acuteSum += km;
      chronicSum += km;
    }
    const atl = acuteSum / 7;
    const ctl = chronicSum / 28;
    const ratio = ctl > 0.01 ? atl / ctl : null;
    return { atl: +atl.toFixed(2), ctl: +ctl.toFixed(2), ratio: ratio ? +ratio.toFixed(2) : null };
  }, [activities]);

  // Calendar heatmap: km per day for last 364 days
  const calendarData = useMemo(() => {
    const dayKm: Record<string, number> = {};
    let maxKm = 0;
    for (const a of activities.filter(isRun)) {
      const dk = a.start_date_local?.slice(0, 10);
      if (!dk) continue;
      dayKm[dk] = (dayKm[dk] || 0) + a.distance / 1000;
      if (dayKm[dk] > maxKm) maxKm = dayKm[dk];
    }
    return { dayKm, maxKm };
  }, [activities]);

  const athlete = tokenRow?.athlete_data;

  const generateAiSummary = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const cutoff = subDays(new Date(), aiRange).toISOString().split("T")[0];
      const recentRuns = activities.filter(a => isRun(a) && a.start_date_local?.slice(0, 10) >= cutoff);
      const res = await fetch("/api/tracker/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runs: recentRuns, range: `${aiRange} days` }),
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

  // ── Loading / connecting ───────────────────────────────────────────────────
  if (tokenLoading || connectStrava.isPending) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "rgba(232,240,244,0.35)", letterSpacing: "0.1em" }}>
          {connectStrava.isPending ? "Connecting to Strava…" : "Loading…"}
        </div>
      </div>
    );
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!tokenRow) {
    return (
      <div>
        <div className="kt-page-header">
          <div className="kt-page-eyebrow">Strava Integration</div>
          <h1 className="kt-page-title">Your <em>Runs</em></h1>
        </div>
        <div style={{ maxWidth: 420, margin: "5rem auto", textAlign: "center" }}>
          <div className="kt-card" style={{ padding: "3rem 2.5rem" }}>
            <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(252,76,2,0.08)", border: "2px solid rgba(252,76,2,0.28)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.75rem" }}>
              <Activity size={30} color="#FC4C02" />
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.35rem", marginBottom: "0.8rem" }}>Connect Strava</div>
            <div style={{ fontSize: "0.8rem", color: "rgba(232,240,244,0.5)", lineHeight: 1.65, marginBottom: "2rem" }}>
              Link your Strava account to see your runs, routes on a map, and how your weight evolves with your training.
            </div>
            <button
              onClick={() => { window.location.href = getStravaAuthUrl(); }}
              style={{ background: "#FC4C02", color: "#fff", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.07em", padding: "0.85rem 2rem", border: "none", borderRadius: 6, cursor: "pointer", width: "100%", transition: "opacity 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Connect with Strava
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Connected ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="kt-page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <div className="kt-page-eyebrow">Strava Integration</div>
          <h1 className="kt-page-title">Your <em>Runs</em></h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
          <button
            onClick={() => disconnectStrava.mutate()}
            className="kt-btn kt-btn-outline"
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <LogOut size={12} /> Disconnect
          </button>
          {dataUpdatedAt > 0 && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.52rem", color: "rgba(232,240,244,0.25)", letterSpacing: "0.04em" }}>
              updated {format(new Date(dataUpdatedAt), "HH:mm:ss")}
            </div>
          )}
        </div>
      </div>

      {/* Athlete bar */}
      {athlete && (
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.5rem", padding: "1rem 1.25rem", background: "#0D0D16", border: "1px solid rgba(0,200,255,0.07)", borderTop: "2px solid rgba(252,76,2,0.25)", borderRadius: 2, flexWrap: "wrap" }}>
          <img
            src={athlete.profile_medium}
            alt={athlete.firstname}
            style={{ width: 46, height: 46, borderRadius: "50%", border: "2px solid rgba(252,76,2,0.4)", flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: "0.92rem", color: "#e8f0f4" }}>{athlete.firstname} {athlete.lastname}</div>
            {athlete.city && <div style={{ fontSize: "0.7rem", color: "rgba(232,240,244,0.4)", marginTop: 2 }}>{athlete.city}, {athlete.country}</div>}
          </div>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {[
              { val: stats.count, label: "Runs" },
              { val: stats.totalKm.toFixed(0) + " km", label: "Total" },
              { val: formatDuration(stats.totalTime), label: "Time" },
            ].map(({ val, label }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "1.15rem", fontWeight: 600, color: "#FC4C02" }}>{val}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.52rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(232,240,244,0.38)", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Training Load */}
      {trainingLoad.ratio !== null && (() => {
        const r = trainingLoad.ratio!;
        const ratioColor = r > 1.3 ? "#ef4444" : r >= 1.0 ? "#22c55e" : r >= 0.8 ? "#60a5fa" : "rgba(232,240,244,0.35)";
        const ratioLabel = r > 1.3 ? "High load" : r >= 1.0 ? "Building fitness" : r >= 0.8 ? "Maintaining" : "Detraining";
        const markerPct = Math.min(Math.max((r / 1.6) * 100, 0), 100);
        return (
          <div className="kt-card" style={{ marginBottom: "2px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div className="kt-card-label" style={{ marginBottom: 0 }}>Training Load</div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: ratioColor, background: ratioColor + "18", padding: "2px 8px", borderRadius: 20 }}>{ratioLabel}</span>
            </div>
            <div style={{ display: "flex", gap: "2.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
              {[
                { val: trainingLoad.atl, label: "Acute · 7d", color: "#FC4C02" },
                { val: trainingLoad.ctl, label: "Chronic · 28d", color: "rgba(232,240,244,0.7)" },
                { val: r.toFixed(2), label: "Ratio ATL/CTL", color: ratioColor },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "1.3rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.52rem", color: "rgba(232,240,244,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Gauge */}
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 1 }}>
                <div style={{ flex: 0.8,  background: "rgba(232,240,244,0.12)" }} />
                <div style={{ flex: 0.2,  background: "#60a5fa",  opacity: 0.6 }} />
                <div style={{ flex: 0.3,  background: "#22c55e",  opacity: 0.7 }} />
                <div style={{ flex: 0.3,  background: "#ef4444",  opacity: 0.65 }} />
              </div>
              <div style={{ position: "absolute", top: -3, left: `calc(${markerPct}% - 5px)`, width: 10, height: 12, borderRadius: 2, background: ratioColor, boxShadow: `0 0 6px ${ratioColor}` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.4rem" }}>
              {[["< 0.8", "Detraining"], ["0.8", ""], ["1.0", "Building"], ["1.3", "High risk"]].map(([tick, lbl]) => (
                <div key={tick} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.48rem", color: "rgba(232,240,244,0.25)", textAlign: "center" }}>
                  {tick}{lbl ? <><br />{lbl}</> : null}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Personal Records */}
      {records && (
        <div className="sv-pr-grid">
          {[
            { label: "Longest Run",   value: formatDist(records.longest.distance),          sub: (() => { const d = parseISO(records.longest.start_date_local); return isValid(d) ? format(d, "MMM d, yyyy") : ""; })() },
            { label: "Fastest Pace",  value: formatPace(records.fastest.average_speed),      sub: formatDist(records.fastest.distance) },
            { label: "Best Week",     value: records.bestWeekKm.toFixed(1) + " km",          sub: "weekly volume" },
            { label: "Most Elevation",value: Math.round(records.mostElev.total_elevation_gain) + " m", sub: formatDist(records.mostElev.distance) },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{ background: "#0D0D16", border: "1px solid rgba(252,76,2,0.12)", borderTop: "2px solid rgba(252,76,2,0.3)", borderRadius: 2, padding: "0.75rem 1rem" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.48rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(232,240,244,0.35)", marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.92rem", fontWeight: 600, color: "#FC4C02" }}>{value}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.55rem", color: "rgba(232,240,244,0.3)", marginTop: 3 }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter pills */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {(["run", "all"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "0.3rem 0.85rem", border: "1px solid", borderRadius: 20, cursor: "pointer", transition: "all 0.13s",
              background: filter === f ? "rgba(252,76,2,0.1)" : "transparent",
              color: filter === f ? "#FC4C02" : "rgba(232,240,244,0.4)",
              borderColor: filter === f ? "rgba(252,76,2,0.35)" : "rgba(232,240,244,0.1)",
            }}
          >
            {f === "run" ? "Runs only" : "All activities"}
          </button>
        ))}
        <div style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "rgba(232,240,244,0.35)", alignSelf: "center" }}>
          {filteredActivities.length} activities
        </div>
      </div>

      {/* Two-column layout */}
      <div className="sv-main-grid">

        {/* Left: activity list */}
        <div className="sv-list">
          {activitiesLoading ? (
            <div style={{ padding: "3rem", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.68rem", color: "rgba(232,240,244,0.3)" }}>
              Fetching activities…
            </div>
          ) : filteredActivities.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.68rem", color: "rgba(232,240,244,0.3)" }}>
              No activities found
            </div>
          ) : filteredActivities.map(a => {
            const dk = isValid(parseISO(a.start_date_local)) ? format(parseISO(a.start_date_local), "yyyy-MM-dd") : "";
            return (
              <ActivityCard
                key={a.id}
                activity={a}
                selected={selectedId === a.id}
                weightKg={dk ? (getLatestWeight(dk) ?? null) : null}
                onClick={() => setSelectedId(selectedId === a.id ? null : a.id)}
              />
            );
          })}
        </div>

        {/* Right column — desktop only */}
        {!isMobile && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <div className="kt-card sv-map">
              {routePositions.length > 0 ? (
                <MapContainer center={routePositions[0]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl attributionControl={false}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                  <Polyline positions={routePositions as any} pathOptions={{ color: "#FC4C02", weight: 3, opacity: 0.9 }} />
                  <CircleMarker center={routePositions[0]} radius={6} pathOptions={{ fillColor: "#22C55E", color: "#fff", weight: 2, fillOpacity: 1 }} />
                  <CircleMarker center={routePositions[routePositions.length - 1]} radius={6} pathOptions={{ fillColor: "#FC4C02", color: "#fff", weight: 2, fillOpacity: 1 }} />
                  <FitBounds positions={routePositions} />
                </MapContainer>
              ) : (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", background: "#080810" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(252,76,2,0.06)", border: "1px solid rgba(252,76,2,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Activity size={22} color="rgba(252,76,2,0.4)" />
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.63rem", color: "rgba(232,240,244,0.28)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {selectedActivity ? "No route data available" : "Select a run to view route"}
                  </div>
                </div>
              )}
            </div>
            {selectedActivity && (
              <div className="kt-card" style={{ padding: "0.85rem 1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", fontWeight: 500, color: "#e8f0f4" }}>{selectedActivity.name}</div>
                  <div style={{ display: "flex", gap: "1.75rem", flexWrap: "wrap" }}>
                    <Stat label="Distance" value={formatDist(selectedActivity.distance)} color="#FC4C02" />
                    <Stat label="Pace" value={formatPace(selectedActivity.average_speed)} />
                    <Stat label="Time" value={formatDuration(selectedActivity.moving_time)} />
                    {selectedActivity.total_elevation_gain > 0 && <Stat label="Elevation" value={`${Math.round(selectedActivity.total_elevation_gain)}m`} />}
                    {selectedActivity.average_heartrate != null && <Stat label="Avg HR" value={`${Math.round(selectedActivity.average_heartrate)} bpm`} />}
                  </div>
                </div>
                {selectedActivity.average_heartrate != null && selectedActivity.max_heartrate != null && (
                  <div style={{ marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px solid rgba(0,200,255,0.08)" }}>
                    <HRZoneBar avgHR={selectedActivity.average_heartrate} maxHR={selectedActivity.max_heartrate} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Weekly chart — full width */}
      <div className="kt-card" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div className="kt-card-label">Weekly km, weight & pace</div>
          <div style={{ display: "flex", gap: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.55rem", color: "rgba(252,76,2,0.7)" }}>
              <div style={{ width: 10, height: 10, background: "rgba(252,76,2,0.5)", borderRadius: 2 }} /> km
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.55rem", color: "#5ad4a0" }}>
              <div style={{ width: 20, height: 2, background: "#5ad4a0", borderRadius: 1 }} /> weight
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.55rem", color: "#a78bfa" }}>
              <div style={{ width: 20, height: 2, background: "#a78bfa", borderRadius: 1 }} /> pace
            </div>
          </div>
        </div>
        {activitiesLoading ? (
          <div style={{ height: 180, display: "flex", alignItems: "flex-end", gap: 6, padding: "0 4px" }}>
            {[45, 70, 30, 85, 55, 90, 40, 65, 50, 75].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, background: "rgba(232,240,244,0.05)", borderRadius: "3px 3px 0 0", animation: `kt-shimmer 1.4s ease-in-out ${i * 0.07}s infinite alternate` }} />
            ))}
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "rgba(232,240,244,0.28)" }}>No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,200,255,0.05)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fill: "rgba(232,240,244,0.3)" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="km" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fill: "rgba(232,240,244,0.3)" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="weight" orientation="right" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fill: "rgba(90,212,160,0.55)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <YAxis yAxisId="pace" hide domain={["dataMax + 0.5", "dataMin - 0.5"]} reversed />
              <Tooltip
                contentStyle={{ background: "#0D0D16", border: "1px solid rgba(0,200,255,0.12)", borderRadius: 2, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}
                labelStyle={{ color: "rgba(232,240,244,0.5)", marginBottom: 4 }}
                formatter={(val: any, name: string) => {
                  if (name === "pace") { const m = Math.floor(val); return [`${m}:${Math.round((val-m)*60).toString().padStart(2,"0")} /km`, "avg pace"]; }
                  return [val, name === "km" ? "km" : "kg"];
                }}
              />
              <Bar yAxisId="km" dataKey="km" fill="rgba(252,76,2,0.45)" name="km" radius={[2,2,0,0]} />
              <Line yAxisId="weight" type="monotone" dataKey="weight" stroke="#5ad4a0" strokeWidth={2} dot={false} connectNulls name="weight" />
              <Line yAxisId="pace" type="monotone" dataKey="pace" stroke="#a78bfa" strokeWidth={1.5} dot={false} connectNulls name="pace" strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Calendar Heatmap */}
      {Object.keys(calendarData.dayKm).length > 0 && (() => {
        const today = new Date();
        // Align to Monday of current week, go back 52 weeks
        const dayOfWeek = (today.getDay() + 6) % 7; // 0 = Mon
        const gridEnd = subDays(today, dayOfWeek - 6); // end on Sunday of current week
        const weeks: string[][] = [];
        for (let w = 51; w >= 0; w--) {
          const week: string[] = [];
          for (let d = 0; d < 7; d++) {
            week.push(format(subDays(gridEnd, w * 7 + (6 - d)), "yyyy-MM-dd"));
          }
          weeks.push(week);
        }
        const monthLabels: { label: string; col: number }[] = [];
        weeks.forEach((week, wi) => {
          const first = week[0];
          if (wi === 0 || first.slice(8, 10) <= "07") {
            const d = parseISO(first);
            if (isValid(d)) {
              const lbl = format(d, "MMM");
              if (!monthLabels.length || monthLabels[monthLabels.length - 1].label !== lbl) {
                monthLabels.push({ label: lbl, col: wi });
              }
            }
          }
        });
        const cellSize = 11;
        const gap = 2;
        return (
          <div className="kt-card" style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div className="kt-card-label" style={{ marginBottom: 0 }}>Activity Calendar</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.5rem", color: "rgba(232,240,244,0.28)" }}>less</span>
                {[0.08, 0.3, 0.55, 0.8, 1].map(o => (
                  <div key={o} style={{ width: 9, height: 9, borderRadius: 2, background: o < 0.1 ? "rgba(255,255,255,0.05)" : `rgba(252,76,2,${o})` }} />
                ))}
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.5rem", color: "rgba(232,240,244,0.28)" }}>more</span>
              </div>
            </div>
            <div style={{ overflowX: "auto", paddingBottom: 4 }}>
              {/* Month labels */}
              <div style={{ display: "flex", gap: gap, marginBottom: 3, paddingLeft: 22 }}>
                {weeks.map((_, wi) => {
                  const ml = monthLabels.find(m => m.col === wi);
                  return (
                    <div key={wi} style={{ width: cellSize, flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.48rem", color: "rgba(232,240,244,0.3)" }}>
                      {ml ? ml.label : ""}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap }}>
                {/* Day labels */}
                <div style={{ display: "flex", flexDirection: "column", gap, marginRight: 2 }}>
                  {["M", "", "W", "", "F", "", "S"].map((d, i) => (
                    <div key={i} style={{ height: cellSize, width: 14, fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.42rem", color: "rgba(232,240,244,0.22)", display: "flex", alignItems: "center" }}>{d}</div>
                  ))}
                </div>
                {/* Grid */}
                {weeks.map((week, wi) => (
                  <div key={wi} style={{ display: "flex", flexDirection: "column", gap }}>
                    {week.map(day => {
                      const km = calendarData.dayKm[day] || 0;
                      const intensity = calendarData.maxKm > 0 ? km / calendarData.maxKm : 0;
                      const isToday = day === format(today, "yyyy-MM-dd");
                      return (
                        <div
                          key={day}
                          title={km > 0 ? `${day}: ${km.toFixed(1)} km` : day}
                          style={{
                            width: cellSize, height: cellSize, borderRadius: 2, flexShrink: 0,
                            background: km > 0 ? `rgba(252,76,2,${0.15 + intensity * 0.85})` : "rgba(255,255,255,0.04)",
                            outline: isToday ? "1px solid rgba(0,200,255,0.5)" : "none",
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Efficiency metrics */}
      {(bodyEffData.length >= 3 || hrEffData.length >= 3) && (
        <div className={`sv-eff-grid${hrEffData.length >= 3 && bodyEffData.length >= 3 ? " sv-eff-2col" : ""}`}>

          {bodyEffData.length >= 3 && (() => {
            const current = bodyEffData[bodyEffData.length - 1].bei;
            const baseline = bodyEffData.slice(0, Math.min(5, bodyEffData.length)).reduce((s, d) => s + d.bei, 0) / Math.min(5, bodyEffData.length);
            const trend = +((current - baseline) / baseline * 100).toFixed(1);
            return (
              <div className="kt-card">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div>
                    <div className="kt-card-label">Body Efficiency Index</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "rgba(232,240,244,0.35)", marginTop: 2 }}>speed per kg bodyweight — higher = better</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "1.15rem", fontWeight: 700, color: "#FC4C02" }}>{current.toFixed(1)}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.58rem", color: trend >= 0 ? "#22C55E" : "#EF4444", marginTop: 2 }}>
                      {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs baseline
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <ComposedChart data={bodyEffData} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,200,255,0.05)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fill: "rgba(232,240,244,0.3)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fill: "rgba(232,240,244,0.3)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{ background: "#0D0D16", border: "1px solid rgba(0,200,255,0.12)", borderRadius: 2, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}
                      labelStyle={{ color: "rgba(232,240,244,0.5)", marginBottom: 3 }}
                      formatter={(val: any, _: any, props: any) => [`${val} (${props.payload.weight} kg)`, "BEI"]}
                    />
                    <Line type="monotone" dataKey="bei" stroke="#FC4C02" strokeWidth={1.5} dot={{ r: 3, fill: "#FC4C02", strokeWidth: 0 }} activeDot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {hrEffData.length >= 3 && (() => {
            const current = hrEffData[hrEffData.length - 1].aei;
            const baseline = hrEffData.slice(0, Math.min(5, hrEffData.length)).reduce((s, d) => s + d.aei, 0) / Math.min(5, hrEffData.length);
            const trend = +((current - baseline) / baseline * 100).toFixed(1);
            return (
              <div className="kt-card">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div>
                    <div className="kt-card-label">Aerobic Efficiency Index</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "rgba(232,240,244,0.35)", marginTop: 2 }}>speed per heartbeat — higher = fitter</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "1.15rem", fontWeight: 700, color: "#a78bfa" }}>{current.toFixed(1)}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.58rem", color: trend >= 0 ? "#22C55E" : "#EF4444", marginTop: 2 }}>
                      {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs baseline
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <ComposedChart data={hrEffData} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,200,255,0.05)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fill: "rgba(232,240,244,0.3)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fill: "rgba(232,240,244,0.3)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{ background: "#0D0D16", border: "1px solid rgba(0,200,255,0.12)", borderRadius: 2, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}
                      labelStyle={{ color: "rgba(232,240,244,0.5)", marginBottom: 3 }}
                      formatter={(val: any, _: any, props: any) => [`${val} (${props.payload.hr} bpm)`, "AEI"]}
                    />
                    <Line type="monotone" dataKey="aei" stroke="#a78bfa" strokeWidth={1.5} dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }} activeDot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

        </div>
      )}

      {/* AI Coach */}
      <div className="kt-card" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.65rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Sparkles size={13} color="#FC4C02" />
            <span className="kt-card-label" style={{ marginBottom: 0 }}>AI Running Coach</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {([30, 60, 90] as const).map(d => (
              <button key={d} onClick={() => { setAiRange(d); setAiSummary(""); }} style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.58rem", letterSpacing: "0.08em",
                padding: "0.25rem 0.7rem", border: "1px solid", borderRadius: 20, cursor: "pointer", transition: "all 0.13s",
                background: aiRange === d ? "rgba(252,76,2,0.1)" : "transparent",
                color: aiRange === d ? "#FC4C02" : "rgba(232,240,244,0.4)",
                borderColor: aiRange === d ? "rgba(252,76,2,0.35)" : "rgba(232,240,244,0.1)",
              }}>{d}d</button>
            ))}
            <button onClick={generateAiSummary} disabled={aiLoading} style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", fontWeight: 600,
              padding: "0.4rem 1rem", border: "none", borderRadius: 8, cursor: aiLoading ? "not-allowed" : "pointer",
              background: aiLoading ? "rgba(252,76,2,0.1)" : "#FC4C02", color: aiLoading ? "rgba(232,240,244,0.4)" : "#fff",
              opacity: aiLoading ? 0.7 : 1, transition: "all 0.15s",
            }}>
              {aiLoading
                ? <><RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} /> Analysing…</>
                : <><Sparkles size={11} /> Analyse</>}
            </button>
          </div>
        </div>
        {aiError && <div style={{ fontSize: "0.8rem", color: "#EF4444" }}>{aiError}</div>}
        {aiSummary
          ? <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", lineHeight: 1.75, color: "rgba(232,240,244,0.85)", margin: 0 }}>{aiSummary}</p>
          : !aiLoading && !aiError && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "rgba(232,240,244,0.28)", textAlign: "center", padding: "1.5rem 0" }}>
              Select a range and analyse your runs
            </div>
          )
        }
      </div>
      {/* Mobile bottom sheet */}
      {isMobile && createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSelectedId(null)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40,
              opacity: selectedId ? 1 : 0,
              pointerEvents: selectedId ? "auto" : "none",
              transition: "opacity 0.25s ease",
            }}
          />
          {/* Sheet */}
          <div
            ref={sheetRef}
            style={{
              position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
              background: "#0D0D16",
              borderTop: "1px solid rgba(0,200,255,0.12)",
              borderRadius: "16px 16px 0 0",
              maxHeight: "85vh",
              overflowY: "auto",
              transform: selectedId ? "translateY(0)" : "translateY(100%)",
              transition: selectedId
                ? "transform 0.45s cubic-bezier(0.34, 1.28, 0.64, 1)"
                : "transform 0.3s cubic-bezier(0.32,0.72,0,1)",
              willChange: "transform",
            }}
          >
            {/* Handle — drag to dismiss */}
            <div
              onTouchStart={onDragStart}
              onTouchMove={onDragMove}
              onTouchEnd={onDragEnd}
              style={{ display: "flex", justifyContent: "center", padding: "0.75rem 0 0.5rem", cursor: "grab", touchAction: "none" }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(232,240,244,0.25)" }} />
            </div>

            {selectedActivity && (
              <div style={{ padding: "0.75rem 1.25rem 2rem" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "1rem", fontWeight: 600, color: "#e8f0f4", marginBottom: 2 }}>
                      {selectedActivity.name}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "rgba(232,240,244,0.35)" }}>
                      {(() => { try { const d = parseISO(selectedActivity.start_date_local); return isValid(d) ? format(d, "EEEE, d MMM yyyy") : ""; } catch { return ""; } })()}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    style={{ background: "rgba(232,240,244,0.06)", border: "none", borderRadius: 8, padding: "0.35rem 0.75rem", color: "rgba(232,240,244,0.5)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", cursor: "pointer" }}
                  >
                    close
                  </button>
                </div>

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
                  {[
                    { label: "Distance", value: formatDist(selectedActivity.distance), accent: "#FC4C02" },
                    { label: "Pace",     value: formatPace(selectedActivity.average_speed) },
                    { label: "Time",     value: formatDuration(selectedActivity.moving_time) },
                    ...(selectedActivity.total_elevation_gain > 0 ? [{ label: "Elevation", value: `${Math.round(selectedActivity.total_elevation_gain)}m` }] : []),
                    ...(selectedActivity.average_heartrate != null ? [{ label: "Avg HR", value: `${Math.round(selectedActivity.average_heartrate)} bpm` }] : []),
                    ...(selectedActivity.max_heartrate != null ? [{ label: "Max HR", value: `${Math.round(selectedActivity.max_heartrate)} bpm` }] : []),
                  ].map(s => (
                    <div key={s.label} style={{ background: "rgba(0,200,255,0.03)", border: "1px solid rgba(0,200,255,0.08)", borderRadius: 8, padding: "0.65rem 0.75rem" }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.52rem", color: "rgba(232,240,244,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.92rem", fontWeight: 700, color: s.accent ?? "#e8f0f4" }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* HR Zones */}
                {selectedActivity.average_heartrate != null && selectedActivity.max_heartrate != null && (
                  <div style={{ marginBottom: "1.25rem", padding: "0.85rem 1rem", background: "rgba(0,200,255,0.03)", border: "1px solid rgba(0,200,255,0.08)", borderRadius: 10 }}>
                    <HRZoneBar avgHR={selectedActivity.average_heartrate} maxHR={selectedActivity.max_heartrate} />
                  </div>
                )}

                {/* Map */}
                {routePositions.length > 0 && (
                  <div style={{ height: 260, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(0,200,255,0.08)" }}>
                    <MapContainer center={routePositions[0]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false} attributionControl={false}>
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                      <Polyline positions={routePositions as any} pathOptions={{ color: "#FC4C02", weight: 3, opacity: 0.9 }} />
                      <CircleMarker center={routePositions[0]} radius={6} pathOptions={{ fillColor: "#22C55E", color: "#fff", weight: 2, fillOpacity: 1 }} />
                      <CircleMarker center={routePositions[routePositions.length - 1]} radius={6} pathOptions={{ fillColor: "#FC4C02", color: "#fff", weight: 2, fillOpacity: 1 }} />
                      <FitBounds positions={routePositions} />
                    </MapContainer>
                  </div>
                )}
              </div>
            )}
          </div>
        </>,
        document.body
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes kt-shimmer { from { opacity: 0.4; } to { opacity: 1; } }
        .sv-main-grid { display: grid; grid-template-columns: 340px 1fr; gap: 2px; align-items: start; }
        .sv-list      { max-height: 78vh; overflow-y: auto; padding-right: 1px; }
        .sv-pr-grid   { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 1rem; }
        .sv-eff-grid  { display: grid; gap: 1rem; margin-top: 1rem; }
        .sv-eff-2col  { grid-template-columns: 1fr 1fr; }
        .sv-map       { padding: 0; overflow: hidden; height: 400px; }
        @media (max-width: 768px) {
          .sv-main-grid { grid-template-columns: 1fr; }
          .sv-list      { max-height: none; }
          .sv-pr-grid   { grid-template-columns: repeat(2,1fr); }
          .sv-eff-grid  { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
