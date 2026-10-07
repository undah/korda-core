// src/features/budget/lib/inzicht.ts — pure calculations behind the budget features.
// No React, no Supabase: everything here is testable with plain data.
import { dagenInMaand, huidigeMaand, isZelfdeMaand, resterendeDagen } from "./budget";
import type {
  PotGroep,
  BudgetMember,
  BudgetMonth,
  BudgetPot,
  BudgetRecurring,
  BudgetSettlement,
  TxMetDelen,
} from "../types";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const rond = (n: number) => Math.round(n * 100) / 100;

// ─── vaste lasten ────────────────────────────────────────────────────────────

/** Amount still needs to land within 25% to count as "this one was paid". */
const MARGE = 0.25;

function hoortBij(last: BudgetRecurring, tx: TxMetDelen): boolean {
  if (tx.amount >= 0 || !last.counterparty) return false;
  const tp = norm(tx.counterparty);
  if (!tp || !(tp.includes(last.counterparty) || last.counterparty.includes(tp))) return false;
  return Math.abs(-tx.amount - last.amount) <= last.amount * MARGE;
}

export type VasteLastStatus = {
  last: BudgetRecurring;
  /** Falls due in this month at all (yearly items only in their month). */
  dezeMaand: boolean;
  betaald: TxMetDelen | null;
  vervaldag: number;
  /** Paid amount differs from the recorded one: a price change to confirm. */
  nieuwePrijs: number | null;
};

export function vasteLastenDezeMaand(
  lasten: BudgetRecurring[],
  transacties: TxMetDelen[],
  maand: BudgetMonth,
): VasteLastStatus[] {
  const laatsteDag = dagenInMaand(maand);
  return lasten.map((last) => {
    const dezeMaand = last.cadence === "maand" || last.month_of_year === maand.month;
    const betaald = dezeMaand ? (transacties.find((t) => hoortBij(last, t)) ?? null) : null;
    const bedrag = betaald ? -betaald.amount : null;
    return {
      last,
      dezeMaand,
      betaald,
      vervaldag: Math.min(last.day_of_month, laatsteDag),
      nieuwePrijs: bedrag !== null && Math.abs(bedrag - last.amount) > Math.max(0.5, last.amount * 0.02) ? bedrag : null,
    };
  });
}

/** Still to be paid this month, soonest first. */
export function komtEraan(statussen: VasteLastStatus[]): VasteLastStatus[] {
  return statussen.filter((s) => s.dezeMaand && !s.betaald).sort((a, b) => a.vervaldag - b.vervaldag);
}

export const maandBedrag = (l: BudgetRecurring) => (l.cadence === "jaar" ? l.amount / 12 : l.amount);
export const jaarBedrag = (l: BudgetRecurring) => (l.cadence === "jaar" ? l.amount : l.amount * 12);

export type Herkenning = {
  tegenpartij: string;
  naam: string;
  bedrag: number;
  dag: number;
  maanden: number;
  potId: string | null;
  lijktAbonnement: boolean;
};

const ABONNEMENT = /netflix|spotify|disney|videoland|hbo|apple|icloud|google|youtube|prime|amazon|ziggo|kpn|odido|vodafone|t-mobile|tele2|nordvpn|adobe|microsoft|dropbox|chatgpt|openai|anthropic|claude|patreon|storytel|audible|nyt|volkskrant|nrc|basic-fit|sportcity|fitness/;

/**
 * Same counterparty, roughly the same amount, in at least two different months:
 * likely a fixed cost. Skips anything already tracked.
 */
export function herkenVasteLasten(transacties: TxMetDelen[], bekend: BudgetRecurring[]): Herkenning[] {
  const bekendeTp = bekend.map((b) => b.counterparty).filter(Boolean) as string[];
  const groepen = new Map<string, TxMetDelen[]>();
  for (const t of transacties) {
    if (t.amount >= 0) continue;
    const tp = norm(t.counterparty);
    if (!tp || bekendeTp.some((b) => tp.includes(b) || b.includes(tp))) continue;
    groepen.set(tp, [...(groepen.get(tp) ?? []), t]);
  }

  const uit: Herkenning[] = [];
  for (const [tp, lijst] of groepen) {
    const maanden = new Set(lijst.map((t) => t.booked_on.slice(0, 7)));
    if (maanden.size < 2) continue;
    const bedragen = lijst.map((t) => -t.amount).sort((a, b) => a - b);
    const mediaan = bedragen[Math.floor(bedragen.length / 2)];
    // Groceries also recur; a fixed cost is one payment per month at a stable price.
    if (lijst.length > maanden.size * 1.5) continue;
    if (bedragen.some((b) => Math.abs(b - mediaan) > mediaan * 0.05)) continue;
    const dagen = lijst.map((t) => Number(t.booked_on.slice(8, 10))).sort((a, b) => a - b);
    // A fixed cost lands around the same day each month; a restaurant visit doesn't.
    if (dagen[dagen.length - 1] - dagen[0] > 6) continue;
    uit.push({
      tegenpartij: tp,
      naam: lijst[0].counterparty ?? tp,
      bedrag: rond(mediaan),
      dag: dagen[Math.floor(dagen.length / 2)],
      maanden: maanden.size,
      potId: lijst.find((t) => t.pot_id)?.pot_id ?? null,
      lijktAbonnement: ABONNEMENT.test(tp),
    });
  }
  return uit.sort((a, b) => b.bedrag - a.bedrag);
}

// ─── veilig per dag ──────────────────────────────────────────────────────────

/**
 * What can safely go out per remaining day: the room left in flexible pots,
 * minus fixed costs still due that are booked against flexible pots. Fixed
 * pots are money already spoken for and stay out of it entirely.
 */
export function veiligeRuimte(
  potjes: BudgetPot[],
  uitgaven: Record<string, number>,
  aankomend: VasteLastStatus[],
  maand: BudgetMonth,
  nu = new Date(),
) {
  const flexibel = potjes.filter((p) => p.kind !== "vast");
  const flexIds = new Set(flexibel.map((p) => p.id));
  const ruimte = flexibel.reduce((s, p) => s + Math.max(0, p.monthly_limit - (uitgaven[p.id] ?? 0)), 0);
  const gereserveerd = aankomend
    .filter((a) => a.last.pot_id && flexIds.has(a.last.pot_id))
    .reduce((s, a) => s + a.last.amount, 0);
  const vrij = Math.max(0, ruimte - gereserveerd);
  const dagen = resterendeDagen(maand, nu);
  return { vrij, gereserveerd, dagen, perDag: dagen > 0 ? vrij / dagen : null };
}

// ─── limietvoorstel ──────────────────────────────────────────────────────────

/**
 * Suggest the average of the last complete months (at least two with spending),
 * rounded to a friendly figure, when it's more than 15% off the current limit.
 */
export function limietVoorstel(
  reeks: Array<{ maand: BudgetMonth; bedrag: number }>,
  limiet: number,
  nu = new Date(),
): { bedrag: number; maanden: number } | null {
  const huidig = huidigeMaand(nu);
  const compleet = reeks.filter((r) => !isZelfdeMaand(r.maand, huidig)).slice(-3).filter((r) => r.bedrag > 0);
  if (compleet.length < 2) return null;
  const gem = compleet.reduce((s, r) => s + r.bedrag, 0) / compleet.length;
  const stap = gem < 100 ? 5 : gem < 1000 ? 10 : 50;
  const voorstel = Math.ceil(gem / stap) * stap;
  if (limiet > 0 && Math.abs(voorstel - limiet) / limiet <= 0.15) return null;
  return { bedrag: voorstel, maanden: compleet.length };
}

// ─── verrekenen ──────────────────────────────────────────────────────────────

export type Saldo = { userId: string; naam: string; betaald: number; aandeel: number; saldo: number };

/**
 * Positive saldo: the others owe you. Shared spending is split by weight;
 * recorded settlements move money between people.
 */
export function verrekenSaldi(
  leden: BudgetMember[],
  betaald: Record<string, number>,
  totaal: number,
  verrekeningen: BudgetSettlement[],
): Saldo[] {
  const som = leden.reduce((s, l) => s + Number(l.split_weight || 1), 0) || 1;
  return leden.map((l) => {
    const aandeel = (totaal * Number(l.split_weight || 1)) / som;
    const terugbetaald = verrekeningen
      .filter((v) => v.from_user === l.user_id)
      .reduce((s, v) => s + v.amount, 0);
    const ontvangen = verrekeningen.filter((v) => v.to_user === l.user_id).reduce((s, v) => s + v.amount, 0);
    const p = betaald[l.user_id] ?? 0;
    return {
      userId: l.user_id,
      naam: l.display_name,
      betaald: rond(p),
      aandeel: rond(aandeel),
      saldo: rond(p - aandeel + terugbetaald - ontvangen),
    };
  });
}

/** The fewest transfers that bring everyone to zero (greedy is optimal enough here). */
export function overboekingen(saldi: Saldo[]): Array<{ van: Saldo; naar: Saldo; bedrag: number }> {
  const schuld = saldi.filter((s) => s.saldo < -0.005).map((s) => ({ s, rest: -s.saldo }));
  const tegoed = saldi.filter((s) => s.saldo > 0.005).map((s) => ({ s, rest: s.saldo }));
  const uit: Array<{ van: Saldo; naar: Saldo; bedrag: number }> = [];
  for (const d of schuld) {
    for (const c of tegoed) {
      if (d.rest < 0.005) break;
      const b = Math.min(d.rest, c.rest);
      if (b < 0.005) continue;
      uit.push({ van: d.s, naar: c.s, bedrag: rond(b) });
      d.rest -= b;
      c.rest -= b;
    }
  }
  return uit;
}

// ─── weekoverzicht ───────────────────────────────────────────────────────────

/** Spending in a pot-aware way: split parts count towards their own pots. */
function regels(t: TxMetDelen): Array<{ pot: string | null; bedrag: number }> {
  return t.splits.length
    ? t.splits.map((s) => ({ pot: s.pot_id, bedrag: s.amount }))
    : [{ pot: t.pot_id, bedrag: t.amount }];
}

/** Day-to-day spending of the last 7 days. Fixed pots (rent) are left out: they'd drown the signal. */
export function weekoverzicht(transacties: TxMetDelen[], potjes: BudgetPot[], nu = new Date()) {
  const vast = new Set(potjes.filter((p) => p.kind === "vast").map((p) => p.id));
  const dag = 86400000;
  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()).getTime();
  const van = vandaag - 6 * dag;
  const vorigeVan = van - 7 * dag;
  let deze = 0;
  let vorige = 0;
  const perPot = new Map<string, number>();
  for (const t of transacties) {
    if (t.soort) continue;
    const d = new Date(t.booked_on + "T00:00:00").getTime();
    for (const r of regels(t)) {
      if (r.bedrag >= 0 || (r.pot && vast.has(r.pot))) continue;
      if (d >= van && d <= vandaag) {
        deze += -r.bedrag;
        if (r.pot) perPot.set(r.pot, (perPot.get(r.pot) ?? 0) - r.bedrag);
      } else if (d >= vorigeVan && d < van) vorige += -r.bedrag;
    }
  }
  const top = [...perPot.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    deze: rond(deze),
    vorige: rond(vorige),
    verschil: rond(deze - vorige),
    topPot: top ? { pot: potjes.find((p) => p.id === top[0]) ?? null, bedrag: rond(top[1]) } : null,
  };
}

const dagSleutel = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * The week page: the same 7 days as weekoverzicht, broken down per day and per
 * pot, with last week's amount per pot to compare. Fixed pots stay out of the
 * totals, but their payments are listed so nothing seems to be missing.
 */
export function weekDetail(transacties: TxMetDelen[], potjes: BudgetPot[], nu = new Date()) {
  const vast = new Set(potjes.filter((p) => p.kind === "vast").map((p) => p.id));
  const dagen: string[] = [];
  for (let i = 6; i >= 0; i--) dagen.push(dagSleutel(new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - i)));
  const vorigeDagen = new Set<string>();
  for (let i = 13; i >= 7; i--) vorigeDagen.add(dagSleutel(new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - i)));
  const dezeDagen = new Set(dagen);

  const perDag = new Map(dagen.map((d) => [d, 0]));
  const perPot = new Map<string | null, { deze: number; vorige: number }>();
  const lijst: TxMetDelen[] = [];
  let vasteLasten = 0;

  for (const t of transacties) {
    const deze = dezeDagen.has(t.booked_on);
    const vorige = vorigeDagen.has(t.booked_on);
    if (!deze && !vorige) continue;
    if (t.soort) continue;
    if (deze && t.amount < 0) lijst.push(t);
    for (const r of regels(t)) {
      if (r.bedrag >= 0) continue;
      if (r.pot && vast.has(r.pot)) {
        if (deze) vasteLasten += -r.bedrag;
        continue;
      }
      const rij = perPot.get(r.pot) ?? { deze: 0, vorige: 0 };
      if (deze) {
        rij.deze += -r.bedrag;
        perDag.set(t.booked_on, (perDag.get(t.booked_on) ?? 0) - r.bedrag);
      } else rij.vorige += -r.bedrag;
      perPot.set(r.pot, rij);
    }
  }

  const totaal = [...perDag.values()].reduce((s, v) => s + v, 0);
  return {
    dagen: dagen.map((datum) => ({ datum, bedrag: rond(perDag.get(datum) ?? 0) })),
    totaal: rond(totaal),
    gemiddeld: rond(totaal / 7),
    vasteLasten: rond(vasteLasten),
    potten: [...perPot.entries()]
      .map(([id, b]) => ({
        pot: id ? (potjes.find((p) => p.id === id) ?? null) : null,
        deze: rond(b.deze),
        vorige: rond(b.vorige),
      }))
      .filter((r) => r.deze > 0 || r.vorige > 0)
      .sort((a, b) => b.deze - a.deze || b.vorige - a.vorige),
    transacties: lijst,
  };
}

// ─── buffer ──────────────────────────────────────────────────────────────────

/** How many months of fixed costs the savings cover. Uses the larger of the two estimates. */
export function bufferMaanden(spaarsaldo: number | null, potjes: BudgetPot[], lasten: BudgetRecurring[]) {
  const vastePotjes = potjes.filter((p) => p.kind === "vast").reduce((s, p) => s + p.monthly_limit, 0);
  const vasteLasten = lasten.reduce((s, l) => s + maandBedrag(l), 0);
  const perMaand = Math.max(vastePotjes, vasteLasten);
  if (spaarsaldo === null || perMaand <= 0) return { perMaand, maanden: null };
  return { perMaand, maanden: spaarsaldo / perMaand };
}

// ─── maandafsluiting ─────────────────────────────────────────────────────────

/** What a closed month leaves over in shared pots — the amount that goes to savings. */
export function maandRestant(potjes: BudgetPot[], uitgaven: Record<string, number>) {
  const regels = potjes
    .filter((p) => p.scope === "shared")
    .map((p) => ({ pot: p, restant: rond(p.monthly_limit - (uitgaven[p.id] ?? 0)) }));
  return {
    regels,
    totaal: rond(regels.reduce((s, r) => s + Math.max(0, r.restant), 0)),
    tekort: rond(regels.reduce((s, r) => s + Math.min(0, r.restant), 0)),
  };
}

/** Suggest a pot for a transaction from the learned rules. */
export function regelVoor(
  tx: Pick<TxMetDelen, "counterparty">,
  regelsLijst: Array<{ counterparty: string; pot_id: string }>,
  zichtbarePotjes: Set<string>,
): string | null {
  const tp = norm(tx.counterparty);
  if (!tp) return null;
  const exact = regelsLijst.find((r) => r.counterparty === tp && zichtbarePotjes.has(r.pot_id));
  if (exact) return exact.pot_id;
  const deels = regelsLijst.find(
    (r) => (tp.includes(r.counterparty) || r.counterparty.includes(tp)) && zichtbarePotjes.has(r.pot_id),
  );
  return deels?.pot_id ?? null;
}

// ─── dubbele afschrijvingen ──────────────────────────────────────────────────

const naamVan = (t: TxMetDelen) => (t.counterparty ?? t.description ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const dagNr = (iso: string) => Math.round(new Date(`${iso}T12:00:00`).getTime() / 86400000);

/**
 * Two payments to the same party for the exact same amount within a few days:
 * a card terminal that charged twice, a subscription billed twice. Small
 * amounts are left out (two coffees are just two coffees), and so are ones
 * marked income or transfer. `negeer` holds pair keys the user said are fine.
 */
export function dubbeleAfschrijvingen(
  transacties: TxMetDelen[],
  negeer: ReadonlySet<string> = new Set(),
  { binnenDagen = 3, vanaf = 5 } = {},
) {
  const groepen = new Map<string, TxMetDelen[]>();
  for (const t of transacties) {
    if (t.soort || t.amount > -vanaf) continue;
    const naam = naamVan(t);
    if (!naam) continue;
    const k = `${naam}|${t.amount.toFixed(2)}`;
    groepen.set(k, [...(groepen.get(k) ?? []), t]);
  }
  const paren: Array<{ sleutel: string; a: TxMetDelen; b: TxMetDelen; dagen: number }> = [];
  for (const lijst of groepen.values()) {
    if (lijst.length < 2) continue;
    const opDatum = [...lijst].sort((x, y) => x.booked_on.localeCompare(y.booked_on) || x.id.localeCompare(y.id));
    for (let i = 1; i < opDatum.length; i++) {
      const [a, b] = [opDatum[i - 1], opDatum[i]];
      const dagen = dagNr(b.booked_on) - dagNr(a.booked_on);
      const sleutel = [a.id, b.id].sort().join("|");
      if (dagen <= binnenDagen && !negeer.has(sleutel)) paren.push({ sleutel, a, b, dagen });
    }
  }
  return paren.sort((x, y) => y.b.booked_on.localeCompare(x.b.booked_on));
}

// ─── nodig / wil / sparen ────────────────────────────────────────────────────

export const GROEPEN: Array<{ id: PotGroep; titel: string; uitleg: string; richtlijn: number }> = [
  { id: "nodig", titel: "Nodig", uitleg: "Wonen, boodschappen, vervoer", richtlijn: 0.5 },
  { id: "wil", titel: "Wil", uitleg: "Uit eten, kleding, leuke dingen", richtlijn: 0.3 },
  { id: "sparen", titel: "Sparen", uitleg: "Sparen en schulden aflossen", richtlijn: 0.2 },
];

/** Income marked as such in a set of transactions (transfers between own accounts excluded). */
export const inkomenVan = (transacties: TxMetDelen[]) =>
  rond(transacties.filter((t) => t.soort === "inkomen" && t.amount > 0).reduce((s, t) => s + t.amount, 0));

/**
 * Spending per 50/30/20 group, against income when there is one. What's left of
 * income after needs and wants counts towards saving: money not spent is money
 * kept, wherever it ends up.
 */
export function verdeling(potjes: BudgetPot[], uitgaven: Record<string, number>, inkomen: number) {
  const per: Record<PotGroep | "zonder", number> = { nodig: 0, wil: 0, sparen: 0, zonder: 0 };
  const budget: Record<PotGroep | "zonder", number> = { nodig: 0, wil: 0, sparen: 0, zonder: 0 };
  for (const p of potjes) {
    const g = p.groep ?? "zonder";
    per[g] += uitgaven[p.id] ?? 0;
    budget[g] += p.monthly_limit;
  }
  const uitgegeven = per.nodig + per.wil + per.sparen + per.zonder;
  const over = inkomen > 0 ? inkomen - uitgegeven : 0;
  return {
    per: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, rond(v)])) as typeof per,
    budget: Object.fromEntries(Object.entries(budget).map(([k, v]) => [k, rond(v)])) as typeof budget,
    uitgegeven: rond(uitgegeven),
    inkomen,
    /** Not spent (yet): with sparen, the part that's kept. */
    over: rond(over),
    totaalBudget: rond(budget.nodig + budget.wil + budget.sparen + budget.zonder),
    zonderGroep: potjes.filter((p) => !p.groep),
  };
}
