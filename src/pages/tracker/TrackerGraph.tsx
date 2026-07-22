// src/pages/tracker/TrackerGraph.tsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { subDays } from "date-fns";
import { Plus } from "lucide-react";
import { useTrackerCheckins, useTrackerGoal, computeWeightProjection } from "@/features/tracker/hooks/useTrackerCheckins";
import { useTrackerPhotos } from "@/features/tracker/hooks/useTrackerJournal";
import WeightTrendChart from "@/features/tracker/components/WeightTrendChart";
import type { TrackerPhoto } from "@/features/tracker/types";

type Range = "1M" | "3M" | "6M" | "1Y" | "All";
const RANGES: Range[] = ["1M", "3M", "6M", "1Y", "All"];
const RANGE_DAYS: Record<Range, number | null> = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "All": null };
// Only show the projected trajectory on wider ranges — it's noise on a 1-month view.
const SHOW_PROJECTION: Record<Range, boolean> = { "1M": false, "3M": true, "6M": true, "1Y": true, "All": true };

export default function TrackerGraph() {
  const { data: checkins = [], isLoading } = useTrackerCheckins(1000);
  const { data: goal } = useTrackerGoal();
  const { data: photos = [] } = useTrackerPhotos();
  const [range, setRange] = useState<Range>("6M");
  const [lightboxPhotos, setLightboxPhotos] = useState<TrackerPhoto[] | null>(null);

  const sorted = useMemo(() => [...checkins].sort((a, b) => a.log_date.localeCompare(b.log_date)), [checkins]);

  const photosByDate = useMemo(() =>
    photos.reduce<Record<string, TrackerPhoto[]>>((acc, p) => {
      acc[p.log_date] = acc[p.log_date] ?? [];
      acc[p.log_date].push(p);
      return acc;
    }, {}),
    [photos]
  );

  const { projectedPoints } = useMemo(() => computeWeightProjection(sorted, goal), [sorted, goal]);

  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!days) return sorted;
    const cutoff = subDays(new Date(), days).toISOString().split("T")[0];
    return sorted.filter(c => c.log_date >= cutoff);
  }, [sorted, range]);

  const startWeight = filtered[0]?.weight ?? sorted[0]?.weight ?? null;
  const currentWeight = sorted[sorted.length - 1]?.weight ?? null;
  const targetWeight = goal?.goal_weight ?? null;
  const change = startWeight != null && currentWeight != null ? +(currentWeight - startWeight).toFixed(1) : null;
  const remaining = currentWeight != null && targetWeight != null ? +(currentWeight - targetWeight).toFixed(1) : null;

  if (isLoading) return (
    <div style={{ color: "var(--kt-dim)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem", paddingTop: "4rem", textAlign: "center" }}>
      loading data...
    </div>
  );

  if (sorted.length < 2) return (
    <div>
      <div className="kt-page-header">
        <p className="kt-page-eyebrow">Graph</p>
        <h1 className="kt-page-title">Weight <em>trend</em></h1>
      </div>
      <div className="kt-card" style={{ textAlign: "center", padding: "4rem 1.5rem" }}>
        <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem", marginBottom: "1rem" }}>Need more data.</p>
        <p style={{ color: "var(--kt-muted)", fontSize: "0.9rem", marginBottom: "2rem" }}>Log at least 2 check-ins to see your trend.</p>
        <Link to="/tracker/progress" className="kt-btn kt-btn-blue" style={{ textDecoration: "none", display: "inline-block" }}>
          Log a check-in →
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

      <div className="kt-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p className="kt-page-eyebrow">Graph</p>
          <h1 className="kt-page-title">Weight <em>trend</em></h1>
        </div>
        <div style={{ display: "flex", background: "var(--kt-surface2)", border: "1px solid var(--kt-border)", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.06em", padding: "0.4rem 0.75rem", background: range === r ? "var(--kt-accent)" : "transparent", color: range === r ? "var(--kt-bg)" : "var(--kt-muted)", border: "none", cursor: "pointer", fontWeight: range === r ? 600 : 400, transition: "all 0.15s" }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Start / Current / Target */}
      <div className="kt-grid-3" style={{ marginBottom: "1.25rem" }}>
        <div className="kt-card" style={{ textAlign: "center" }}>
          <p className="kt-card-label">Start</p>
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.25rem", color: "var(--kt-text)" }}>{startWeight ?? "—"} kg</p>
        </div>
        <div className="kt-card" style={{ textAlign: "center", borderTop: "2px solid var(--kt-accent)" }}>
          <p className="kt-card-label">Current</p>
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.5rem", fontWeight: 600, color: "var(--kt-accent)" }}>{currentWeight ?? "—"} kg</p>
        </div>
        <div className="kt-card" style={{ textAlign: "center" }}>
          <p className="kt-card-label">Target</p>
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.25rem", color: "var(--kt-text)" }}>{targetWeight ?? "—"} kg</p>
        </div>
      </div>

      {/* Chart */}
      <div className="kt-card" style={{ marginBottom: "1.25rem" }}>
        <WeightTrendChart
          points={filtered.map(c => ({ date: c.log_date, weight: c.weight }))}
          projected={SHOW_PROJECTION[range] ? projectedPoints : []}
          goal={targetWeight}
          photosByDate={photosByDate}
          height={300}
          monthTicksOnly={range !== "1M"}
          onDotClick={date => {
            const p = photosByDate[date];
            if (p?.length) setLightboxPhotos(p);
          }}
        />
        {photos.length > 0 && (
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.12em", color: "var(--kt-dim)", marginTop: "0.75rem" }}>
            filled dots = days with photos · tap to open
          </p>
        )}
      </div>

      {/* Change / Remaining */}
      <div className="kt-grid-2" style={{ marginBottom: "2rem" }}>
        <div className="kt-card">
          <p className="kt-card-label">Change</p>
          <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.6rem", fontWeight: 400, color: change != null ? (change <= 0 ? "var(--kt-green)" : "var(--kt-red)") : "var(--kt-text)" }}>
            {change != null ? `${change > 0 ? "+" : ""}${change} kg` : "—"}
          </p>
          <p className="kt-card-sub">over selected range</p>
        </div>
        <div className="kt-card">
          <p className="kt-card-label">Remaining</p>
          <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.6rem", fontWeight: 400, color: "var(--kt-text)" }}>
            {remaining != null ? `${Math.abs(remaining)} kg` : "—"}
          </p>
          <p className="kt-card-sub">{targetWeight != null ? "to target" : "no goal set"}</p>
        </div>
      </div>

      {/* Floating add button */}
      <Link
        to="/tracker/progress"
        aria-label="Log today's check-in"
        style={{ position: "fixed", bottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)", right: "1.5rem", width: 52, height: 52, borderRadius: "50%", background: "var(--kt-accent)", color: "var(--kt-bg)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 40, textDecoration: "none" }}
      >
        <Plus size={22} strokeWidth={2.5} />
      </Link>
    </div>
  );
}
