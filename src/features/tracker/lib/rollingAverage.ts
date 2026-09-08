// src/features/tracker/lib/rollingAverage.ts
//
// A trailing average over a real DATE window.
//
// The previous implementation took a fixed slice of seven ROWS
// (`sorted.slice(i - 6, i + 1)`) and labelled it "7d avg". With weekly
// check-ins that averages seven weeks, so on a ~50-day lag the line sat 6kg
// above the true weight and still claimed to be a seven-day mean.
//
// Row-count windows only coincide with day windows when you log exactly daily.
// This keys off the dates themselves, so the window means what it says at any
// cadence.

import { differenceInCalendarDays, parseISO } from "date-fns";

export interface DatedWeight {
  log_date: string;
  weight: number;
}

export interface RollingAverage {
  /** log_date -> trailing average, for every row given. */
  byDate: Record<string, number>;
  /** Mean samples per window. At ~1 the "average" is the raw value renamed. */
  density: number;
}

/**
 * @param sorted rows ordered oldest-first
 * @param days   width of the trailing window, inclusive of the current day
 */
export function rollingAverage(sorted: DatedWeight[], days: number): RollingAverage {
  const byDate: Record<string, number> = {};
  if (!sorted.length) return { byDate, density: 0 };

  const dates = sorted.map(r => parseISO(r.log_date));
  let start = 0;
  let counted = 0;

  for (let i = 0; i < sorted.length; i++) {
    // Advance the window's tail until everything inside it is within `days`.
    while (differenceInCalendarDays(dates[i], dates[start]) >= days) start++;
    let sum = 0;
    for (let j = start; j <= i; j++) sum += sorted[j].weight;
    const n = i - start + 1;
    byDate[sorted[i].log_date] = +(sum / n).toFixed(2);
    counted += n;
  }

  return { byDate, density: counted / sorted.length };
}

/**
 * Whether a smoothing line is worth drawing at all.
 *
 * Below two samples per window the line is the raw series with a different
 * name and colour, which is worse than absent — it implies a smoothing that
 * isn't happening. Weekly loggers land here; daily loggers do not, so the
 * line appears on its own once the data supports it.
 */
export const MIN_WINDOW_DENSITY = 2;
export const smoothingIsMeaningful = (r: RollingAverage) => r.density >= MIN_WINDOW_DENSITY;
