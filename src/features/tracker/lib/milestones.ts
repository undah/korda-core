// src/features/tracker/lib/milestones.ts
import type { ProgressStats } from "../types";

const STORAGE_KEY = "kt-milestones-seen";

function getSeen(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

export function markMilestoneSeen(id: string) {
  try {
    const seen = getSeen();
    if (!seen.includes(id)) localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen, id]));
  } catch { /* localStorage unavailable — skip persistence, not worth failing over */ }
}

/** Returns the single most-notable milestone the user has crossed but not yet been shown, or null. */
export function getUnseenMilestone(stats: ProgressStats): { id: string; message: string } | null {
  const seen = getSeen();
  const candidates: { id: string; message: string }[] = [];

  const lostSteps = Math.floor(stats.totalLost / 5);
  for (let n = lostSteps; n >= 1; n--) {
    candidates.push({ id: `lost-${n * 5}`, message: `🎉 You've lost ${n * 5} kg!` });
  }

  if (stats.percentToGoal >= 100) candidates.push({ id: "goal-100", message: "🏁 Goal reached!" });
  else [75, 50, 25].forEach(p => {
    if (stats.percentToGoal >= p) candidates.push({ id: `goal-${p}`, message: `🎯 You're ${p}% of the way to your goal!` });
  });

  [100, 60, 30, 14, 7].forEach(d => {
    if (stats.currentStreak >= d) candidates.push({ id: `streak-${d}`, message: `🔥 ${d}-day check-in streak!` });
  });

  return candidates.find(c => !seen.includes(c.id)) ?? null;
}
