import React, { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { TrackerCheckin } from "../types";

interface Props {
  checkins: TrackerCheckin[];
  height?: number;
}

// Client-side 7-day rolling average of lean_mass_kg.
// Computed over the full sorted array so filtered-range starts have real lookback values.
// Fat mass is left raw — it changes slowly and doesn't suffer from hydration noise.
function buildRollingLean(sorted: TrackerCheckin[]): Record<string, number | null> {
  const map: Record<string, number | null> = {};
  for (let i = 0; i < sorted.length; i++) {
    const window = sorted.slice(Math.max(0, i - 6), i + 1).filter(c => c.lean_mass_kg != null);
    map[sorted[i].log_date] = window.length > 0
      ? +(window.reduce((s, c) => s + c.lean_mass_kg!, 0) / window.length).toFixed(2)
      : null;
  }
  return map;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const fat  = payload.find(p => p.dataKey === "fat")?.value as number | undefined;
  const lean = payload.find(p => p.dataKey === "lean")?.value as number | undefined;
  const total = fat != null && lean != null ? (fat + lean).toFixed(1) : null;

  return (
    <div style={{
      background: "var(--kt-surface2)", border: "1px solid var(--kt-border)",
      borderRadius: 6, padding: "0.6rem 0.9rem",
      fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", lineHeight: 1.9,
    }}>
      <p style={{ color: "var(--kt-dim)", marginBottom: "0.15rem" }}>{label}</p>
      <p style={{ color: "#f97316" }}>fat   {fat  != null ? `${fat.toFixed(1)} kg`  : "—"}</p>
      <p style={{ color: "#06b6d4" }}>lean  {lean != null ? `${lean.toFixed(1)} kg` : "—"}</p>
      {total && (
        <p style={{ color: "var(--kt-dim)", borderTop: "1px solid var(--kt-border)", marginTop: "0.3rem", paddingTop: "0.3rem" }}>
          total {total} kg
        </p>
      )}
    </div>
  );
}

export default function BodyCompChart({ checkins, height = 260 }: Props) {
  const data = useMemo(() => {
    const all = [...checkins].sort((a, b) => a.log_date.localeCompare(b.log_date));
    const leanAvg = buildRollingLean(all);

    return all
      .filter(c => c.fat_mass_kg != null && c.lean_mass_kg != null)
      .map(c => ({
        date: c.log_date,
        fat:  c.fat_mass_kg!,
        lean: leanAvg[c.log_date] ?? c.lean_mass_kg!,
      }));
  }, [checkins]);

  if (data.length === 0) {
    return (
      <p style={{
        color: "var(--kt-dim)", fontFamily: "'IBM Plex Mono',monospace",
        fontSize: "0.75rem", textAlign: "center", padding: "2.5rem 0",
      }}>
        No body composition data yet — add a body fat % to any check-in to see this chart.
      </p>
    );
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="bcGradFat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f97316" stopOpacity={0.50} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.12} />
            </linearGradient>
            <linearGradient id="bcGradLean" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: "var(--kt-dim)" }}
            tickFormatter={d => {
              const [, m, day] = d.split("-");
              return `${parseInt(day, 10)}/${parseInt(m, 10)}`;
            }}
            minTickGap={36}
          />
          <YAxis
            tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: "var(--kt-dim)" }}
            tickFormatter={v => `${v}`}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="fat"
            stackId="body"
            stroke="#f97316"
            strokeWidth={1.5}
            fill="url(#bcGradFat)"
            dot={false}
            activeDot={{ r: 4, fill: "#f97316", stroke: "none" }}
          />
          <Area
            type="monotone"
            dataKey="lean"
            stackId="body"
            stroke="#06b6d4"
            strokeWidth={1.5}
            fill="url(#bcGradLean)"
            dot={false}
            activeDot={{ r: 4, fill: "#06b6d4", stroke: "none" }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p style={{
        fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.08em",
        color: "var(--kt-dim)", marginTop: "0.75rem", lineHeight: 1.7,
      }}>
        <span style={{ color: "#f97316" }}>■</span> fat mass (raw) &nbsp;
        <span style={{ color: "#06b6d4" }}>■</span> lean mass (7-day avg) &nbsp;·&nbsp;
        BIA estimates are directional — hydration shifts lean mass day-to-day
      </p>
    </>
  );
}
