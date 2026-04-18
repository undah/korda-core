// src/pages/tracker/TrackerDashboard.tsx
import React from "react";
import { Link } from "react-router-dom";
import { useTrackerCheckins, useTrackerGoal, useProgressStats } from "@/features/tracker/hooks/useTrackerCheckins";
import { useTrackerCalories } from "@/features/tracker/hooks/useTrackerJournal";

function StatCard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="kt-card">
      <p className="kt-card-label">{label}</p>
      <p className="kt-card-value" style={accent ? {} : { color: "#dde8ed", fontSize: "1.4rem" }}>{value}</p>
      {sub && <p className="kt-card-sub">{sub}</p>}
    </div>
  );
}

export default function TrackerDashboard() {
  const { data: checkins = [], isLoading } = useTrackerCheckins(90);
  const { data: goal } = useTrackerGoal();
  const { data: calories = [] } = useTrackerCalories(7);
  const stats = useProgressStats();

  const sorted = [...checkins].sort((a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime());
  const latest = sorted[sorted.length - 1];
  const todayCalories = calories[0];

  // rolling 7d avg
  const last7 = sorted.slice(-7);
  const avg7 = last7.length > 0 ? +(last7.reduce((s, c) => s + c.weight, 0) / last7.length).toFixed(1) : null;

  // week-over-week
  const prev7 = sorted.slice(-14, -7);
  const avgPrev7 = prev7.length > 0 ? +(prev7.reduce((s, c) => s + c.weight, 0) / prev7.length).toFixed(1) : null;
  const weekChange = avg7 && avgPrev7 ? +(avg7 - avgPrev7).toFixed(1) : null;

  if (isLoading) {
    return (
      <div style={{ color: "rgba(221,232,237,0.3)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem", paddingTop: "4rem", textAlign: "center" }}>
        loading data...
      </div>
    );
  }

  if (checkins.length === 0) {
    return (
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
  }

  return (
    <div>
      {/* header */}
      <div className="kt-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p className="kt-page-eyebrow">Overview</p>
          <h1 className="kt-page-title">Your <em>dashboard</em></h1>
        </div>
        <Link to="/tracker/progress" className="kt-btn kt-btn-blue" style={{ textDecoration: "none", marginTop: "0.5rem" }}>
          + Log today
        </Link>
      </div>

      {/* top stats */}
      <div className="kt-grid-4" style={{ marginBottom: 2 }}>
        <StatCard
          label="Current weight"
          value={latest ? `${latest.weight} kg` : "—"}
          sub={`7d avg: ${avg7 ?? "—"} kg`}
          accent
        />
        <StatCard
          label="Total lost"
          value={stats ? `${stats.totalLost > 0 ? "-" : "+"}${Math.abs(stats.totalLost)} kg` : "—"}
          sub={goal?.goal_weight ? `Goal: ${goal.goal_weight} kg` : undefined}
          accent
        />
        <StatCard
          label="Goal progress"
          value={stats ? `${stats.percentToGoal}%` : "—"}
          sub={stats?.daysToGoal ? `~${stats.daysToGoal} days left` : undefined}
          accent
        />
        <StatCard
          label="Check-in streak"
          value={stats ? `${stats.currentStreak}d` : "—"}
          sub={`${checkins.length} total entries`}
          accent
        />
      </div>

      <div className="kt-grid-4" style={{ marginBottom: "2rem" }}>
        <StatCard label="Weekly change" value={weekChange !== null ? `${weekChange > 0 ? "+" : ""}${weekChange} kg` : "—"} sub="vs last 7 days" />
        <StatCard label="Avg weekly loss" value={stats ? `${stats.avgWeeklyLoss} kg` : "—"} sub="based on trend" />
        <StatCard label="Best week" value={stats ? `${stats.bestWeek} kg` : "—"} sub="largest weekly drop" />
        <StatCard
          label="Today's calories"
          value={todayCalories ? `${todayCalories.calories_in} kcal` : "—"}
          sub={todayCalories ? `${todayCalories.deficit > 0 ? "-" : "+"}${Math.abs(todayCalories.deficit)} deficit` : "not logged"}
        />
      </div>

      {/* weight chart */}
      <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <p className="kt-card-label">Weight trend — last 30 days</p>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem", color: "rgba(221,232,237,0.4)" }}>
              7-day rolling average
            </p>
          </div>
        </div>
        <WeightMiniChart checkins={sorted.slice(-30)} />
      </div>

      {/* recent checkins + quick links */}
      <div className="kt-grid-2">
        {/* recent */}
        <div className="kt-card">
          <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Recent check-ins</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {sorted.slice(-5).reverse().map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid rgba(90,180,212,0.06)", fontSize: "0.82rem" }}>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "rgba(221,232,237,0.4)", fontSize: "0.72rem" }}>{c.log_date}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "#5ab4d4", fontWeight: 500 }}>{c.weight} kg</span>
                {c.waist && <span style={{ color: "rgba(221,232,237,0.3)", fontSize: "0.72rem" }}>W {c.waist} cm</span>}
              </div>
            ))}
          </div>
          <Link to="/tracker/progress" style={{ display: "block", marginTop: "1rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", color: "rgba(90,180,212,0.5)", textDecoration: "none", letterSpacing: "0.1em" }}>
            View all →
          </Link>
        </div>

        {/* quick links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { to: "/tracker/journal",  label: "Write today's journal",  sub: "Mood, energy, wins & struggles" },
            { to: "/tracker/calories", label: "Log calories",           sub: "Track intake vs deficit" },
            { to: "/tracker/photos",   label: "Add progress photo",     sub: "Front, side, or back" },
            { to: "/tracker/analysis", label: "View analysis",          sub: "Trends, projections, insights" },
          ].map((item) => (
            <Link key={item.to} to={item.to} style={{ textDecoration: "none" }}>
              <div className="kt-card" style={{ cursor: "pointer", transition: "background 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#0f151a")}
                onMouseLeave={e => (e.currentTarget.style.background = "#0c1217")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: "0.85rem", fontWeight: 500, color: "#dde8ed", marginBottom: "0.2rem" }}>{item.label}</p>
                    <p style={{ fontSize: "0.75rem", color: "rgba(221,232,237,0.3)" }}>{item.sub}</p>
                  </div>
                  <span style={{ color: "rgba(90,180,212,0.4)", fontSize: "1rem" }}>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── mini weight chart ────────────────────────────────────────────────────────

function WeightMiniChart({ checkins }: { checkins: { weight: number; log_date: string }[] }) {
  if (checkins.length < 2) return <p style={{ color: "rgba(221,232,237,0.2)", fontSize: "0.8rem" }}>Not enough data yet.</p>;

  const W = 800, H = 160, PAD = 20;
  const weights = checkins.map(c => c.weight);
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;

  const x = (i: number) => PAD + (i / (checkins.length - 1)) * (W - PAD * 2);
  const y = (w: number) => H - PAD - ((w - min) / (max - min)) * (H - PAD * 2);

  const linePath = checkins.map((c, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(c.weight)}`).join(" ");

  // 7d rolling avg
  const avgPoints = checkins.map((_, i) => {
    const slice = checkins.slice(Math.max(0, i - 6), i + 1);
    const avg = slice.reduce((s, c) => s + c.weight, 0) / slice.length;
    return { x: x(i), y: y(avg) };
  });
  const avgPath = avgPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  // area fill under avg
  const areaPath = `${avgPath} L${avgPoints[avgPoints.length - 1].x},${H} L${avgPoints[0].x},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* grid */}
      {[0.25, 0.5, 0.75].map(t => {
        const yy = PAD + t * (H - PAD * 2);
        return <line key={t} x1={PAD} y1={yy} x2={W - PAD} y2={yy} stroke="rgba(90,180,212,0.06)" strokeWidth="1" />;
      })}
      {/* area */}
      <path d={areaPath} fill="rgba(90,180,212,0.05)" />
      {/* raw line */}
      <path d={linePath} fill="none" stroke="rgba(90,180,212,0.2)" strokeWidth="1" strokeDasharray="3 3" />
      {/* avg line */}
      <path d={avgPath} fill="none" stroke="rgba(90,180,212,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* latest dot */}
      <circle cx={x(checkins.length - 1)} cy={y(checkins[checkins.length - 1].weight)} r="4" fill="#5ab4d4" />
      {/* y labels */}
      <text x={PAD - 4} y={y(max) + 4} fill="rgba(90,180,212,0.3)" fontFamily="IBM Plex Mono,monospace" fontSize="10" textAnchor="end">{max.toFixed(1)}</text>
      <text x={PAD - 4} y={y(min) + 4} fill="rgba(90,180,212,0.3)" fontFamily="IBM Plex Mono,monospace" fontSize="10" textAnchor="end">{min.toFixed(1)}</text>
    </svg>
  );
}
