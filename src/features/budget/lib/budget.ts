// src/features/budget/lib/budget.ts — formatting, month maths and pot status
import type { BudgetMonth } from "../types";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const euroRond = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export const formatEuro = (n: number) => euro.format(n);
/** Without cents, for limits and big figures where cents are noise. */
export const formatEuroRond = (n: number) => euroRond.format(n);

/** Reads "400", "400,50" or "1.250,00" the way a Dutch user types it. */
export function parseBedrag(tekst: string): number {
  const t = tekst.replace(/[^\d.,]/g, "");
  if (!t) return 0;
  const getal = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(getal) ? Math.round(getal * 100) / 100 : 0;
}

export function huidigeMaand(nu = new Date()): BudgetMonth {
  return { year: nu.getFullYear(), month: nu.getMonth() + 1 };
}

export function verschuifMaand(m: BudgetMonth, delta: number): BudgetMonth {
  const d = new Date(m.year, m.month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** ISO bounds [from, to) for a calendar month — the budget period. */
export function maandGrenzen(m: BudgetMonth): { van: string; tot: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const volgende = verschuifMaand(m, 1);
  return {
    van: `${m.year}-${pad(m.month)}-01`,
    tot: `${volgende.year}-${pad(volgende.month)}-01`,
  };
}

export function maandNaam(m: BudgetMonth): string {
  return new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(
    new Date(m.year, m.month - 1, 1),
  );
}

export function isZelfdeMaand(a: BudgetMonth, b: BudgetMonth) {
  return a.year === b.year && a.month === b.month;
}

/** Share of the month already behind us, 0..1 — for "on pace" judgements. */
export function maandVoortgang(m: BudgetMonth, nu = new Date()): number {
  const huidig = huidigeMaand(nu);
  if (m.year < huidig.year || (m.year === huidig.year && m.month < huidig.month)) return 1;
  if (!isZelfdeMaand(m, huidig)) return 0;
  const dagen = new Date(m.year, m.month, 0).getDate();
  return nu.getDate() / dagen;
}

export type PotStatus = "ok" | "bijna" | "over";

/** Warning threshold agreed for phase 4 alerts; the meter uses the same line. */
export const WAARSCHUW_BIJ = 0.8;

export function potStatus(uitgegeven: number, limiet: number): PotStatus {
  if (limiet <= 0) return uitgegeven > 0 ? "over" : "ok";
  if (uitgegeven > limiet) return "over";
  if (uitgegeven >= limiet * WAARSCHUW_BIJ) return "bijna";
  return "ok";
}

/** Short invite code without look-alike characters (no 0/O, 1/I/L). */
export function maakUitnodigingscode(lengte = 6): string {
  const tekens = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(lengte));
  return Array.from(bytes, (b) => tekens[b % tekens.length]).join("");
}

/** Starter pots offered on an empty household; limits are only suggestions. */
export const VOORGESTELDE_POTJES: Array<{ name: string; emoji: string; monthly_limit: number }> = [
  { name: "Boodschappen", emoji: "🛒", monthly_limit: 500 },
  { name: "Vaste lasten", emoji: "🏠", monthly_limit: 1200 },
  { name: "Uit eten", emoji: "🍝", monthly_limit: 150 },
  { name: "Vervoer", emoji: "🚗", monthly_limit: 150 },
  { name: "Abonnementen", emoji: "📺", monthly_limit: 60 },
  { name: "Kleding", emoji: "👕", monthly_limit: 75 },
  { name: "Huis & tuin", emoji: "🪴", monthly_limit: 75 },
  { name: "Cadeaus", emoji: "🎁", monthly_limit: 50 },
];
