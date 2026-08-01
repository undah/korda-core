// src/features/tracker/lib/progress.ts
// Types + derivation for the KordaTracker progress export card.
//
// Column names match `tracker_checkins` exactly, so a TrackerCheckin row with a
// non-null body_fat is directly assignable to WeighIn — no mapping layer.
//
// fat_mass_kg / lean_mass_kg are STORED generated columns (see
// supabase/migrate_body_composition.sql). We still fall back to computing them
// so the card works on rows that predate the migration.

import { differenceInCalendarDays, format, parseISO } from "date-fns";

export interface WeighIn {
  log_date: string;   // ISO date, e.g. "2026-05-10"
  weight: number;     // kg
  body_fat: number;   // percent
  fat_mass_kg?: number | null;
  lean_mass_kg?: number | null;
}

export interface ProgressStats {
  before: WeighIn;
  after: WeighIn;
  fatBefore: number;
  fatAfter: number;
  leanAfter: number;
  weightDelta: number; // negative on a cut
  bfDelta: number;     // percentage points, negative on a cut
  fatLost: number;     // negative on a cut
  days: number;
  weeks: number;
  rate: number;        // kg per week, absolute
}

const fatMass = (w: number, bf: number) => (w * bf) / 100;

export function deriveProgress(before: WeighIn, after: WeighIn): ProgressStats {
  const fatBefore = before.fat_mass_kg ?? fatMass(before.weight, before.body_fat);
  const fatAfter  = after.fat_mass_kg  ?? fatMass(after.weight,  after.body_fat);
  const leanAfter = after.lean_mass_kg ?? after.weight - fatAfter;

  // Calendar-day diff on locally-parsed dates — avoids the UTC-midnight
  // off-by-one that `new Date("YYYY-MM-DD")` produces west of Greenwich.
  const days  = Math.max(1, differenceInCalendarDays(parseISO(after.log_date), parseISO(before.log_date)));
  const weeks = days / 7;
  const weightDelta = after.weight - before.weight;

  return {
    before,
    after,
    fatBefore,
    fatAfter,
    leanAfter,
    weightDelta,
    bfDelta: after.body_fat - before.body_fat,
    fatLost: fatAfter - fatBefore,
    days,
    weeks,
    rate: Math.abs(weightDelta) / weeks,
  };
}

// ---- formatters ----
const MINUS = "−"; // proper minus sign, matches the design

/** one decimal, real minus sign for negatives: -17 -> "−17.0" */
export const signed1 = (n: number) => (n < 0 ? MINUS : "") + Math.abs(n).toFixed(1);
/** absolute, one decimal: "11.0" */
export const abs1 = (n: number) => Math.abs(n).toFixed(1);

/** "10 MAY" (no year) */
export const dayMonth = (iso: string) => format(parseISO(iso), "d MMM").toUpperCase();
/** "26 JUL 2026" */
export const dayMonthYear = (iso: string) => format(parseISO(iso), "d MMM yyyy").toUpperCase();
