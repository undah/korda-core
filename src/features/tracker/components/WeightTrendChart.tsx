// src/features/tracker/components/WeightTrendChart.tsx
import React, { useMemo, useState } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { TrackerPhoto } from "../types";

export interface WeightChartPoint {
  date: string;
  weight: number;
  /** Optional pre-computed 7-day rolling average (over the full history, not just the visible range). */
  avg7?: number;
}

interface ChartRow {
  date: string;
  weight?: number;
  avg7?: number;
  projected?: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: ChartRow }[];
}

function makeTooltip(photosByDate: Record<string, TrackerPhoto[]>) {
  return function WtcTooltip({ active, payload }: TooltipProps) {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    const dayPhotos = photosByDate[row.date] ?? [];
    return (
      <div style={{ background: "var(--kt-surface)", border: "1px solid var(--kt-border)", borderRadius: 10, padding: "0.7rem 1rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", pointerEvents: "none" }}>
        <p style={{ color: "var(--kt-dim)", marginBottom: "0.35rem", fontSize: "0.68rem" }}>
          {(() => { try { return format(parseISO(row.date), "EEE, MMM d yyyy"); } catch { return row.date; } })()}
        </p>
        {row.weight != null && <p style={{ color: "var(--kt-accent)", fontWeight: 500, fontSize: "0.9rem" }}>{row.weight} kg</p>}
        {row.avg7 != null && <p style={{ color: "var(--kt-muted)", marginTop: "0.15rem" }}>7d avg: {row.avg7} kg</p>}
        {row.projected != null && row.weight == null && <p style={{ color: "#5ad4a0" }}>{row.projected} kg projected</p>}
        {dayPhotos.length > 0 && (
          <p style={{ marginTop: "0.4rem", paddingTop: "0.4rem", borderTop: "1px solid var(--kt-border)", fontSize: "0.6rem", color: "var(--kt-dim)" }}>
            {dayPhotos.length} photo{dayPhotos.length > 1 ? "s" : ""} · tap to view
          </p>
        )}
      </div>
    );
  };
}

function LineToggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "none", border: "1px solid", borderColor: active ? "var(--kt-border)" : "transparent", borderRadius: 6, padding: "0.2rem 0.55rem", cursor: "pointer", opacity: active ? 1 : 0.35, transition: "all 0.15s" }}
    >
      {icon}
      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "var(--kt-muted)", textDecoration: active ? "none" : "line-through" }}>{label}</span>
    </button>
  );
}

interface WeightTrendChartProps {
  /** Historical points in range, sorted ascending. */
  points: WeightChartPoint[];
  /** Future trajectory toward the goal, sorted ascending. */
  projected?: { date: string; projected: number }[];
  goal?: number | null;
  photosByDate?: Record<string, TrackerPhoto[]>;
  onDotClick?: (date: string) => void;
  height?: number;
  monthTicksOnly?: boolean;
}

export default function WeightTrendChart({
  points,
  projected = [],
  goal,
  photosByDate = {},
  onDotClick,
  height = 260,
  monthTicksOnly = false,
}: WeightTrendChartProps) {
  const hasAvg = points.some(p => p.avg7 != null);
  const hasProjected = projected.length > 0;

  const [showRaw, setShowRaw] = useState(true);
  const [showAvg, setShowAvg] = useState(true);
  const [showProjected, setShowProjected] = useState(true);

  const combined = useMemo<ChartRow[]>(() => {
    const hist: ChartRow[] = points.map((p, i) => ({
      date: p.date,
      weight: p.weight,
      avg7: p.avg7,
      projected: i === points.length - 1 && projected.length ? p.weight : undefined,
    }));
    if (!projected.length) return hist;
    return [...hist, ...projected.map(p => ({ date: p.date, projected: p.projected }))];
  }, [points, projected]);

  const allVals = [
    ...points.map(p => p.weight),
    ...projected.map(p => p.projected),
    ...(goal != null ? [goal] : []),
  ];
  const yMin = allVals.length ? Math.floor(Math.min(...allVals) - 1.5) : 0;
  const yMax = allVals.length ? Math.ceil(Math.max(...allVals) + 1.5) : 100;

  const TooltipContent = useMemo(() => makeTooltip(photosByDate), [photosByDate]);

  if (points.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--kt-dim)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem" }}>Not enough data for this range.</p>
      </div>
    );
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={combined}
          margin={{ top: 10, right: 12, bottom: 0, left: 0 }}
          onClick={(d: { activePayload?: { payload: ChartRow }[] }) => {
            const date = d?.activePayload?.[0]?.payload?.date;
            if (date && onDotClick) onDotClick(date);
          }}
        >
          <defs>
            <linearGradient id="wtcGoalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5ad4a0" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#5ad4a0" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={d => { try { return format(parseISO(d), monthTicksOnly ? "MMM" : "MMM d"); } catch { return ""; } }}
            tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: "var(--kt-dim)" }}
            axisLine={false} tickLine={false}
            interval="preserveStartEnd"
            minTickGap={monthTicksOnly ? 36 : 20}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: "var(--kt-dim)" }}
            axisLine={false} tickLine={false} tickCount={5} width={36}
          />
          <Tooltip content={<TooltipContent />} cursor={{ stroke: "var(--kt-border)", strokeWidth: 1 }} />

          {goal != null && (
            <ReferenceLine y={goal} stroke="rgba(90,212,160,0.4)" strokeDasharray="5 4" strokeWidth={1} />
          )}

          {showProjected && hasProjected && (
            <Area type="monotone" dataKey="projected" stroke="none" fill="url(#wtcGoalGrad)" connectNulls activeDot={false} />
          )}
          {showProjected && hasProjected && (
            <Line type="monotone" dataKey="projected" stroke="#5ad4a0" strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} connectNulls />
          )}

          {showRaw && (
            <Line
              type="monotone"
              dataKey="weight"
              stroke="var(--kt-accent)"
              strokeWidth={2.5}
              connectNulls
              dot={(props: { cx?: number; cy?: number; payload: ChartRow }) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null) return <g key={`d-${payload.date}`} />;
                const hasPhotos = (photosByDate[payload.date]?.length ?? 0) > 0;
                return (
                  <circle
                    key={`d-${payload.date}`}
                    cx={cx} cy={cy} r={hasPhotos ? 5 : 3.5}
                    fill={hasPhotos ? "var(--kt-accent)" : "var(--kt-surface)"}
                    stroke="var(--kt-accent)"
                    strokeWidth={2}
                    style={{ cursor: hasPhotos ? "pointer" : "default" }}
                  />
                );
              }}
              activeDot={{ r: 6, fill: "var(--kt-accent)", strokeWidth: 2, stroke: "var(--kt-surface)" }}
            />
          )}

          {showAvg && hasAvg && (
            <Line type="monotone" dataKey="avg7" stroke="#5ab4d4" strokeWidth={2} dot={false} activeDot={false} connectNulls />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {(hasAvg || hasProjected) && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px solid var(--kt-border)", flexWrap: "wrap" }}>
          <LineToggle
            active={showRaw}
            onClick={() => setShowRaw(v => !v)}
            label="Raw"
            icon={<svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="var(--kt-accent)" strokeWidth="1.5" /></svg>}
          />
          {hasAvg && (
            <LineToggle
              active={showAvg}
              onClick={() => setShowAvg(v => !v)}
              label="7d avg"
              icon={<svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="#5ab4d4" strokeWidth="2" /></svg>}
            />
          )}
          {hasProjected && (
            <LineToggle
              active={showProjected}
              onClick={() => setShowProjected(v => !v)}
              label="Projected"
              icon={<svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="#5ad4a0" strokeWidth="1.5" strokeDasharray="4 3" /></svg>}
            />
          )}
        </div>
      )}
    </>
  );
}
