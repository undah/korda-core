import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import polylineLib from "@mapbox/polyline";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Activity, LogOut, Mountain, Heart } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, startOfWeek, isValid } from "date-fns";
import {
  useStravaToken, useStravaActivities, useConnectStrava,
  useDisconnectStrava, getStravaAuthUrl, StravaActivity,
} from "@/features/tracker/hooks/useStrava";
import { useTrackerCheckins } from "@/features/tracker/hooks/useTrackerCheckins";
import "leaflet/dist/leaflet.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDist(m: number) { return (m / 1000).toFixed(2) + " km"; }

function formatRaceTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
    ? format(parseISO(activity.start_date_local), "MMM d, yyyy")
    : "";

  return (
    <div
      onClick={onClick}
      style={{
        padding: "0.9rem 1rem",
        background: selected ? "rgba(252,76,2,0.07)" : "#0D0D16",
        border: `1px solid ${selected ? "rgba(252,76,2,0.35)" : "rgba(0,200,255,0.07)"}`,
        borderTop: `2px solid ${selected ? "#FC4C02" : "rgba(0,200,255,0.16)"}`,
        borderRadius: 2,
        cursor: "pointer",
        transition: "all 0.13s",
        marginBottom: 2,
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.45rem" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "rgba(232,240,244,0.38)", letterSpacing: "0.06em" }}>{date}</div>
        {weightKg && (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "#5ad4a0" }}>
            {weightKg.toFixed(1)} kg
          </div>
        )}
      </div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.83rem", color: "#e8f0f4", marginBottom: "0.6rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {activity.name}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
        <Stat label="Distance" value={formatDist(activity.distance)} color="#FC4C02" />
        <Stat label="Pace" value={formatPace(activity.average_speed)} />
        <Stat label="Time" value={formatDuration(activity.moving_time)} />
        {activity.total_elevation_gain > 0 && <Stat label="Elev" value={`${Math.round(activity.total_elevation_gain)}m`} />}
        {activity.average_heartrate != null && <Stat label="Avg HR" value={`${Math.round(activity.average_heartrate)} bpm`} />}
        {activity.average_cadence != null && <Stat label="Cadence" value={`${Math.round(activity.average_cadence)} spm`} />}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TrackerStrava() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"run" | "all">("run");

  const { data: tokenRow, isLoading: tokenLoading } = useStravaToken();
  const { data: activities = [], isLoading: activitiesLoading } = useStravaActivities();
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

  // Race predictions via Riegel formula: T2 = T1 × (D2/D1)^1.06
  const racePredictions = useMemo(() => {
    const runs = activities.filter(isRun).filter(a => a.distance >= 1000 && a.average_speed > 0);
    if (!runs.length) return null;
    const ref = runs.reduce((b, a) => a.average_speed > b.average_speed ? a : b, runs[0]);
    const predict = (targetM: number) => ref.moving_time * Math.pow(targetM / ref.distance, 1.06);
    return {
      ref,
      races: [
        { name: "5K",   dist: 5000 },
        { name: "10K",  dist: 10000 },
        { name: "Half", dist: 21097 },
        { name: "Full", dist: 42195 },
      ].map(({ name, dist }) => {
        const secs = predict(dist);
        return { name, time: formatRaceTime(Math.round(secs)), pace: formatPace(dist / secs) };
      }),
    };
  }, [activities]);

  const athlete = tokenRow?.athlete_data;

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
        <button
          onClick={() => disconnectStrava.mutate()}
          className="kt-btn kt-btn-outline"
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.3rem" }}
        >
          <LogOut size={12} /> Disconnect
        </button>
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

      {/* Personal Records */}
      {records && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: "1rem" }}>
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

      {/* Race Predictor */}
      {racePredictions && (
        <div className="kt-card" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.85rem" }}>
            <div className="kt-card-label">Race Predictor</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.52rem", color: "rgba(232,240,244,0.3)" }}>
              based on {formatPace(racePredictions.ref.average_speed)} over {formatDist(racePredictions.ref.distance)}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {racePredictions.races.map(({ name, time, pace }) => (
              <div key={name} style={{ textAlign: "center", padding: "0.65rem 0.5rem", background: "#080810", borderRadius: 4, border: "1px solid rgba(0,200,255,0.06)" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.48rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(232,240,244,0.35)", marginBottom: 6 }}>{name}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "1rem", fontWeight: 600, color: "#FC4C02", marginBottom: 4 }}>{time}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.55rem", color: "rgba(232,240,244,0.35)" }}>{pace}</div>
              </div>
            ))}
          </div>
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
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "2px", alignItems: "start" }}>

        {/* Left: activity list */}
        <div style={{ maxHeight: "78vh", overflowY: "auto", paddingRight: 1 }}>
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

        {/* Right: map + chart */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>

          {/* Map */}
          <div className="kt-card" style={{ padding: 0, overflow: "hidden", height: 400 }}>
            {routePositions.length > 0 ? (
              <MapContainer
                center={routePositions[0]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                zoomControl
                attributionControl={false}
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <Polyline positions={routePositions as any} pathOptions={{ color: "#FC4C02", weight: 3, opacity: 0.9 }} />
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

          {/* Selected run stats strip */}
          {selectedActivity && (
            <div className="kt-card" style={{ padding: "0.85rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", fontWeight: 500, color: "#e8f0f4" }}>{selectedActivity.name}</div>
                <div style={{ display: "flex", gap: "1.75rem", flexWrap: "wrap" }}>
                  <Stat label="Distance" value={formatDist(selectedActivity.distance)} color="#FC4C02" />
                  <Stat label="Pace" value={formatPace(selectedActivity.average_speed)} />
                  <Stat label="Time" value={formatDuration(selectedActivity.moving_time)} />
                  {selectedActivity.total_elevation_gain > 0 && (
                    <Stat label="Elevation" value={`${Math.round(selectedActivity.total_elevation_gain)}m`} />
                  )}
                  {selectedActivity.average_heartrate != null && (
                    <Stat label="Avg HR" value={`${Math.round(selectedActivity.average_heartrate)} bpm`} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Progress chart */}
          <div className="kt-card">
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
                  <div style={{ width: 20, height: 2, background: "#a78bfa", borderRadius: 1, borderTop: "2px dashed #a78bfa" }} /> pace
                </div>
              </div>
            </div>
            {chartData.length === 0 ? (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "rgba(232,240,244,0.28)" }}>
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,200,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fill: "rgba(232,240,244,0.3)" }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    yAxisId="km"
                    tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fill: "rgba(232,240,244,0.3)" }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    yAxisId="weight"
                    orientation="right"
                    tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fill: "rgba(90,212,160,0.55)" }}
                    axisLine={false} tickLine={false}
                    domain={["auto", "auto"]}
                  />
                  <YAxis yAxisId="pace" hide domain={["dataMax + 0.5", "dataMin - 0.5"]} reversed />
                  <Tooltip
                    contentStyle={{ background: "#0D0D16", border: "1px solid rgba(0,200,255,0.12)", borderRadius: 2, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}
                    labelStyle={{ color: "rgba(232,240,244,0.5)", marginBottom: 4 }}
                    formatter={(val: any, name: string) => {
                      if (name === "pace") {
                        const mins = Math.floor(val);
                        const secs = Math.round((val - mins) * 60);
                        return [`${mins}:${secs.toString().padStart(2, "0")} /km`, "avg pace"];
                      }
                      return [val, name === "km" ? "km" : "kg"];
                    }}
                  />
                  <Bar yAxisId="km" dataKey="km" fill="rgba(252,76,2,0.45)" name="km" radius={[2, 2, 0, 0]} />
                  <Line yAxisId="weight" type="monotone" dataKey="weight" stroke="#5ad4a0" strokeWidth={2} dot={false} connectNulls name="weight" />
                  <Line yAxisId="pace" type="monotone" dataKey="pace" stroke="#a78bfa" strokeWidth={1.5} dot={false} connectNulls name="pace" strokeDasharray="4 2" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
