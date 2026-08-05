// src/features/tracker/components/JournalCorrelation.tsx
//
// Cross-references the daily journal (sleep / energy / mood) against weekly
// weight change — the one thing the app collects every day and never reads back.
//
// Form: a dumbbell per metric, not a chart. Two cohorts × three metrics is
// "before → after per item", so each row is one shared scale with two marks.
// One hue, two shades; both marks are direct-labelled and the legend names them,
// so identity is never carried by color alone.
import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Moon, Battery, Smile } from "lucide-react";
import type { TrackerCheckin, TrackerJournal } from "../types";

/** Ordinal scales — journal stores words, comparison needs numbers. */
const MOOD_SCORE: Record<string, number> = { great: 5, good: 4, okay: 3, low: 2, bad: 1 };
const ENERGY_SCORE: Record<string, number> = { high: 3, medium: 2, low: 1 };

/** Weeks per cohort below this and the comparison is noise, not signal. */
const MIN_WEEKS_PER_COHORT = 3;

function mondayOf(iso: string): string {
  const d = parseISO(iso);
  const m = new Date(d);
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return format(m, "yyyy-MM-dd");
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

interface Metric {
  key: "sleep" | "energy" | "mood";
  label: string;
  icon: typeof Moon;
  unit: string;
  /** Formats the cohort average for display. */
  fmt: (n: number) => string;
}

const METRICS: Metric[] = [
  { key: "sleep",  label: "Sleep",  icon: Moon,    unit: "h",   fmt: n => `${n.toFixed(1)}h` },
  { key: "energy", label: "Energy", icon: Battery, unit: "/3",  fmt: n => `${n.toFixed(1)}/3` },
  { key: "mood",   label: "Mood",   icon: Smile,   unit: "/5",  fmt: n => `${n.toFixed(1)}/5` },
];

export default function JournalCorrelation({
  checkins,
  journal,
}: {
  checkins: TrackerCheckin[];
  journal: TrackerJournal[];
}) {
  const result = useMemo(() => {
    // ── weekly weight averages, Monday-start (matches the rest of Analysis)
    const wk: Record<string, number[]> = {};
    checkins.forEach(c => {
      const k = mondayOf(c.log_date);
      (wk[k] ??= []).push(c.weight);
    });
    const weeks = Object.keys(wk).sort();
    const weightAvg: Record<string, number> = {};
    weeks.forEach(k => { weightAvg[k] = mean(wk[k]); });

    // ── weekly journal averages, only over days that actually recorded a value
    const jr: Record<string, { sleep: number[]; energy: number[]; mood: number[] }> = {};
    journal.forEach(e => {
      const k = mondayOf(e.log_date);
      const b = (jr[k] ??= { sleep: [], energy: [], mood: [] });
      if (e.sleep_hrs != null) b.sleep.push(e.sleep_hrs);
      if (e.energy && ENERGY_SCORE[e.energy]) b.energy.push(ENERGY_SCORE[e.energy]);
      if (e.mood && MOOD_SCORE[e.mood]) b.mood.push(MOOD_SCORE[e.mood]);
    });

    // ── join: a week counts only if it has a previous week to measure change against
    type Row = { week: string; delta: number; sleep?: number; energy?: number; mood?: number };
    const rows: Row[] = [];
    weeks.forEach((k, i) => {
      if (i === 0) return;
      const prev = weeks[i - 1];
      const b = jr[k];
      if (!b) return;
      rows.push({
        week: k,
        delta: weightAvg[k] - weightAvg[prev],
        sleep:  b.sleep.length  ? mean(b.sleep)  : undefined,
        energy: b.energy.length ? mean(b.energy) : undefined,
        mood:   b.mood.length   ? mean(b.mood)   : undefined,
      });
    });

    const down = rows.filter(r => r.delta < 0);
    const flat = rows.filter(r => r.delta >= 0);

    const comparisons = METRICS.map(m => {
      const d = down.map(r => r[m.key]).filter((v): v is number => v != null);
      const f = flat.map(r => r[m.key]).filter((v): v is number => v != null);
      if (d.length < MIN_WEEKS_PER_COHORT || f.length < MIN_WEEKS_PER_COHORT) return null;
      return { metric: m, downAvg: mean(d), flatAvg: mean(f), nDown: d.length, nFlat: f.length };
    }).filter((c): c is NonNullable<typeof c> => c !== null);

    return { comparisons, nDown: down.length, nFlat: flat.length, nRows: rows.length };
  }, [checkins, journal]);

  const { comparisons, nDown, nFlat } = result;

  if (comparisons.length === 0) {
    return (
      <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
        <p className="kt-card-label" style={{ marginBottom: "0.3rem" }}>Sleep, energy & mood vs weight</p>
        <p className="kt-meta" style={{ marginBottom: "1rem" }}>what your losing weeks have in common</p>
        <p style={{ fontSize: "var(--kt-fs-sm)", color: "var(--kt-muted)", lineHeight: 1.7 }}>
          Not enough overlap yet. This needs at least {MIN_WEEKS_PER_COHORT} weeks where you
          lost weight and {MIN_WEEKS_PER_COHORT} where you didn't, each with journal entries.
          {" "}You currently have <strong style={{ color: "var(--kt-text)" }}>{nDown}</strong> and{" "}
          <strong style={{ color: "var(--kt-text)" }}>{nFlat}</strong>.
        </p>
        <p className="kt-meta" style={{ marginTop: "0.75rem", lineHeight: 1.6 }}>
          keep logging mood, energy and sleep on the Journal page and this fills itself in
        </p>
      </div>
    );
  }

  return (
    <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
      <p className="kt-card-label" style={{ marginBottom: "0.3rem" }}>Sleep, energy & mood vs weight</p>
      <p className="kt-meta" style={{ marginBottom: "1.5rem" }}>what your losing weeks have in common</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
        {comparisons.map(({ metric, downAvg, flatAvg }) => (
          <DumbbellRow key={metric.key} metric={metric} downAvg={downAvg} flatAvg={flatAvg} />
        ))}
      </div>

      {/* Two marks share every row, so the legend is mandatory. */}
      <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--kt-border)" }}>
        <LegendKey color="var(--kt-accent)" label={`Weeks you lost (${nDown})`} />
        <LegendKey color="var(--kt-dim)" label={`Weeks you didn't (${nFlat})`} filled={false} />
      </div>

      <p className="kt-meta" style={{ marginTop: "0.85rem", lineHeight: 1.65 }}>
        association, not cause — with {nDown + nFlat} weeks of data this is a hint worth
        testing, not a finding
      </p>
    </div>
  );
}

function LegendKey({ color, label, filled = true }: { color: string; label: string; filled?: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: filled ? color : "transparent", border: `2px solid ${color}`, flexShrink: 0 }} />
      <span className="kt-meta">{label}</span>
    </span>
  );
}

function DumbbellRow({ metric, downAvg, flatAvg }: { metric: Metric; downAvg: number; flatAvg: number }) {
  // Shared scale per row, padded so neither mark ever sits on the track edge.
  const lo = Math.min(downAvg, flatAvg);
  const hi = Math.max(downAvg, flatAvg);
  const pad = Math.max((hi - lo) * 0.9, hi * 0.04) || 1;
  const min = lo - pad;
  const max = hi + pad;
  const pos = (v: number) => ((v - min) / (max - min)) * 100;

  const diff = downAvg - flatAvg;
  const better = diff > 0; // more sleep / energy / mood on losing weeks
  const Icon = metric.icon;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem", gap: "0.75rem" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontFamily: "'DM Sans',sans-serif", fontSize: "var(--kt-fs-xs)", fontWeight: 500, color: "var(--kt-muted)" }}>
          <Icon size={13} />
          {metric.label}
        </span>
        {/* Direction gets a word as well as a color. */}
        <span className="kt-num" style={{ fontSize: "var(--kt-fs-xs)", color: better ? "var(--kt-green)" : "var(--kt-red)" }}>
          {better ? "+" : "−"}{Math.abs(diff).toFixed(1)}{metric.unit === "h" ? "h" : ""} {better ? "higher" : "lower"}
        </span>
      </div>

      <div style={{ position: "relative", height: 26 }}>
        {/* track */}
        <div style={{ position: "absolute", top: 11, left: 0, right: 0, height: 3, background: "var(--kt-border)", borderRadius: "var(--kt-r-full)" }} />
        {/* connector between the two marks */}
        <div style={{
          position: "absolute", top: 11, height: 3, borderRadius: "var(--kt-r-full)",
          background: "var(--kt-accent)", opacity: 0.35,
          left: `${Math.min(pos(downAvg), pos(flatAvg))}%`,
          width: `${Math.abs(pos(downAvg) - pos(flatAvg))}%`,
        }} />
        {/* "didn't lose" — hollow, recessive */}
        <Mark left={pos(flatAvg)} label={metric.fmt(flatAvg)} color="var(--kt-dim)" filled={false} />
        {/* "lost" — solid accent, the one that carries the story */}
        <Mark left={pos(downAvg)} label={metric.fmt(downAvg)} color="var(--kt-accent)" filled />
      </div>
    </div>
  );
}

function Mark({ left, label, color, filled }: { left: number; label: string; color: string; filled: boolean }) {
  return (
    <div style={{ position: "absolute", left: `${left}%`, top: 0, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{
        width: 12, height: 12, borderRadius: "50%", marginTop: 6,
        background: filled ? color : "var(--kt-surface)",
        border: `2px solid ${color}`, boxShadow: "0 0 0 2px var(--kt-surface)", flexShrink: 0,
      }} />
      <span className="kt-num" style={{ fontSize: "var(--kt-fs-3xs)", color: filled ? "var(--kt-text)" : "var(--kt-dim)", marginTop: 3, whiteSpace: "nowrap" }}>
        {label}
      </span>
    </div>
  );
}
