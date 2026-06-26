import React, { useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { subDays } from "date-fns";
import { useTrackerCheckins } from "@/features/tracker/hooks/useTrackerCheckins";
import { useTrackerJournal } from "@/features/tracker/hooks/useTrackerJournal";
import { useTrackerGoal } from "@/features/tracker/hooks/useTrackerGoal";
import { useStravaActivities, useStravaToken } from "@/features/tracker/hooks/useStrava";

type Range = "7d" | "30d" | "90d";

const RANGES: { label: string; value: Range; days: number }[] = [
  { label: "7 days",  value: "7d",  days: 7  },
  { label: "30 days", value: "30d", days: 30 },
  { label: "90 days", value: "90d", days: 90 },
];

export default function TrackerAI() {
  const [range, setRange] = useState<Range>("30d");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: checkins = [] } = useTrackerCheckins(365);
  const { data: journal = [] }  = useTrackerJournal(90);
  const { data: goal }          = useTrackerGoal();
  const { data: tokenRow }      = useStravaToken();
  const { data: allRuns = [] }  = useStravaActivities();

  const selectedRange = RANGES.find(r => r.value === range)!;

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const cutoff = subDays(new Date(), selectedRange.days).toISOString().split("T")[0];
      const recentCheckins = checkins.filter(c => c.log_date >= cutoff);
      const recentJournal  = journal.filter(j => j.log_date >= cutoff);
      const recentRuns     = allRuns.filter(r => r.start_date_local?.slice(0, 10) >= cutoff);

      const res = await fetch("/api/tracker/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkins: recentCheckins,
          journal: recentJournal,
          goal,
          runs: recentRuns,
          range: selectedRange.label,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { summary: text } = await res.json();
      setSummary(text);
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="kt-page-header">
        <div className="kt-page-eyebrow">AI Coach</div>
        <h1 className="kt-page-title">Your <em>Summary</em></h1>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => { setRange(r.value); setSummary(""); }}
              style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", letterSpacing: "0.08em",
                padding: "0.3rem 0.85rem", border: "1px solid", borderRadius: 20, cursor: "pointer", transition: "all 0.13s",
                background: range === r.value ? "rgba(0,200,255,0.08)" : "transparent",
                color: range === r.value ? "var(--kt-accent)" : "var(--kt-muted)",
                borderColor: range === r.value ? "rgba(0,200,255,0.3)" : "var(--kt-border)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <button
          onClick={generate}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: "0.45rem",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.06em",
            padding: "0.5rem 1.25rem", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "rgba(0,200,255,0.08)" : "var(--kt-accent)", color: loading ? "var(--kt-muted)" : "#080810",
            transition: "all 0.15s", opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Analysing…</>
            : <><Sparkles size={13} /> Generate</>
          }
        </button>

        {!tokenRow && (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.58rem", color: "var(--kt-dim)" }}>
            Connect Strava for run insights
          </span>
        )}
      </div>

      {/* Output */}
      {error && (
        <div className="kt-card" style={{ borderColor: "rgba(239,68,68,0.3)", borderTop: "2px solid var(--kt-red)" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--kt-red)" }}>{error}</div>
        </div>
      )}

      {summary ? (
        <div className="kt-card" style={{ borderTop: "2px solid var(--kt-accent)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <Sparkles size={13} color="var(--kt-accent)" />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--kt-accent)", opacity: 0.7 }}>
              AI analysis · last {selectedRange.label}
            </span>
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.92rem", lineHeight: 1.75, color: "var(--kt-text)", margin: 0 }}>
            {summary}
          </p>
        </div>
      ) : !loading && !error && (
        <div className="kt-card" style={{ padding: "4rem 2rem", textAlign: "center" }}>
          <Sparkles size={28} color="var(--kt-dim)" style={{ margin: "0 auto 1rem" }} />
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", color: "var(--kt-muted)", marginBottom: "0.4rem" }}>
            Select a time range and generate your AI summary
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--kt-dim)" }}>
            Analyses weight, journal, and Strava runs together
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
