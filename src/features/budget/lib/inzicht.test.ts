import { describe, expect, it } from "vitest";
import {
  herkenVasteLasten,
  komtEraan,
  limietVoorstel,
  overboekingen,
  vasteLastenDezeMaand,
  veiligeRuimte,
  verrekenSaldi,
  dubbeleAfschrijvingen,
  inkomenPerMaand,
  voorstelVoor,
  verdeling,
  weekDetail,
  weekoverzicht,
} from "./inzicht";
import { opDatum } from "./budget";
import type { BudgetMember, BudgetPot, BudgetRecurring, BudgetSettlement, TxMetDelen } from "../types";

const tx = (o: Partial<TxMetDelen>): TxMetDelen => ({
  id: Math.random().toString(36),
  account_id: "acc",
  household_id: "hh",
  booked_on: "2026-10-01",
  amount: -10,
  currency: "EUR",
  counterparty: "x",
  description: null,
  pot_id: null,
  pot_status: "unassigned",
  note: null,
  splits: [],
  account: null,
  ...o,
});

const pot = (o: Partial<BudgetPot>): BudgetPot => ({
  id: "p",
  household_id: "hh",
  name: "Pot",
  emoji: "💶",
  monthly_limit: 100,
  scope: "shared",
  kind: "flexibel",
  owner_id: null,
  sort_order: 0,
  archived_at: null,
  created_at: "",
  ...o,
});

const last = (o: Partial<BudgetRecurring>): BudgetRecurring => ({
  id: "r",
  household_id: "hh",
  name: "Huur",
  counterparty: "vesteda",
  amount: 1000,
  previous_amount: null,
  price_changed_at: null,
  cadence: "maand",
  day_of_month: 1,
  month_of_year: null,
  is_subscription: false,
  pot_id: null,
  scope: "shared",
  owner_id: null,
  source: "handmatig",
  reviewed_at: null,
  created_at: "",
  ...o,
});

const lid = (id: string, w = 1): BudgetMember => ({
  household_id: "hh",
  user_id: id,
  display_name: id,
  role: "member",
  split_weight: w,
  joined_at: "",
});

describe("verrekenen", () => {
  it("splits shared spending 50/50 and zeroes out after paying back", () => {
    const leden = [lid("a"), lid("b")];
    const voor = verrekenSaldi(leden, { a: 100 }, 100, []);
    expect(voor.map((s) => s.saldo)).toEqual([50, -50]);
    expect(overboekingen(voor)).toEqual([expect.objectContaining({ bedrag: 50 })]);
    expect(overboekingen(voor)[0].van.userId).toBe("b");

    const terug: BudgetSettlement = {
      id: "s", household_id: "hh", from_user: "b", to_user: "a", amount: 50,
      note: null, created_by: "b", created_at: "",
    };
    expect(verrekenSaldi(leden, { a: 100 }, 100, [terug]).map((s) => s.saldo)).toEqual([0, 0]);
  });

  it("respects an income-based key (60/40)", () => {
    const saldi = verrekenSaldi([lid("a", 60), lid("b", 40)], { a: 50, b: 50 }, 100, []);
    expect(saldi.map((s) => s.saldo)).toEqual([-10, 10]);
  });
});

describe("vaste lasten", () => {
  it("marks a fixed cost paid when a matching transaction exists, and spots a price change", () => {
    const st = vasteLastenDezeMaand(
      [last({}), last({ id: "n", name: "Netflix", counterparty: "netflix", amount: 13.99, day_of_month: 20 })],
      [tx({ counterparty: "Vesteda Huur", amount: -1000 }), tx({ counterparty: "NETFLIX.COM", amount: -15.99 })],
      { year: 2026, month: 10 },
    );
    expect(st[0].betaald).not.toBeNull();
    expect(st[1].nieuwePrijs).toBe(15.99);
    expect(komtEraan(st)).toHaveLength(0);
  });

  it("only expects yearly items in their own month", () => {
    const st = vasteLastenDezeMaand([last({ cadence: "jaar", month_of_year: 3 })], [], { year: 2026, month: 10 });
    expect(komtEraan(st)).toHaveLength(0);
  });

  it("recognises a monthly cost but not groceries", () => {
    const h = herkenVasteLasten(
      [
        tx({ counterparty: "Spotify", amount: -11.99, booked_on: "2026-08-03" }),
        tx({ counterparty: "Spotify", amount: -11.99, booked_on: "2026-09-03" }),
        ...["2026-08-02", "2026-08-09", "2026-08-16", "2026-09-02", "2026-09-09"].map((d) =>
          tx({ counterparty: "Albert Heijn", amount: -40, booked_on: d }),
        ),
      ],
      [],
    );
    expect(h.map((x) => x.tegenpartij)).toEqual(["spotify"]);
    expect(h[0].lijktAbonnement).toBe(true);
  });
});

describe("veilig per dag", () => {
  it("leaves fixed pots out and reserves fixed costs still due in flexible pots", () => {
    const r = veiligeRuimte(
      [pot({ id: "flex", monthly_limit: 400 }), pot({ id: "vast", kind: "vast", monthly_limit: 1000 })],
      { flex: 100 },
      komtEraan(vasteLastenDezeMaand([last({ amount: 50, pot_id: "flex", day_of_month: 28 })], [], { year: 2026, month: 10 })),
      { year: 2026, month: 10 },
      new Date(2026, 9, 22),
    );
    expect(r.gereserveerd).toBe(50);
    expect(r.vrij).toBe(250);
    expect(r.dagen).toBe(10);
    expect(r.perDag).toBe(25);
  });
});

describe("limietvoorstel", () => {
  it("suggests the rounded average of complete months when it is well off", () => {
    const reeks = [8, 9].map((m) => ({ maand: { year: 2026, month: m }, bedrag: 470 }));
    expect(limietVoorstel(reeks, 300, new Date(2026, 9, 5))).toEqual({ bedrag: 470, maanden: 2 });
    expect(limietVoorstel(reeks, 460, new Date(2026, 9, 5))).toBeNull();
  });
});

describe("tempo", () => {
  it("forecasts the day a pot runs out, but not in the first days", () => {
    expect(opDatum(200, 500, { year: 2026, month: 10 }, new Date(2026, 9, 10))).toBe(25);
    expect(opDatum(200, 500, { year: 2026, month: 10 }, new Date(2026, 9, 2))).toBeNull();
  });
});

describe("weekoverzicht", () => {
  it("compares the last 7 days with the 7 before and counts split parts", () => {
    const w = weekoverzicht(
      [
        tx({ booked_on: "2026-10-20", amount: -30, pot_id: "p" }),
        tx({
          booked_on: "2026-10-19",
          amount: -50,
          splits: [
            { id: "1", transaction_id: "t", household_id: "hh", pot_id: "p", amount: -20 },
            { id: "2", transaction_id: "t", household_id: "hh", pot_id: "q", amount: -30 },
          ],
        }),
        tx({ booked_on: "2026-10-10", amount: -40 }),
      ],
      [pot({ id: "p" })],
      new Date(2026, 9, 21),
    );
    expect(w.deze).toBe(80);
    expect(w.vorige).toBe(40);
    expect(w.topPot?.bedrag).toBe(50);
  });

  it("leaves fixed pots like rent out", () => {
    const w = weekoverzicht(
      [tx({ booked_on: "2026-10-20", amount: -1000, pot_id: "huur" }), tx({ booked_on: "2026-10-20", amount: -30, pot_id: "p" })],
      [pot({ id: "huur", kind: "vast" }), pot({ id: "p" })],
      new Date(2026, 9, 21),
    );
    expect(w.deze).toBe(30);
  });
});

describe("weekDetail", () => {
  it("splits the week per day and per pot, leaving fixed pots out of the totals", () => {
    const potjes = [pot({ id: "p", name: "Boodschappen" }), pot({ id: "huur", name: "Huur", kind: "vast" })];
    const w = weekDetail(
      [
        tx({ booked_on: "2026-10-20", amount: -30, pot_id: "p" }),
        tx({ booked_on: "2026-10-14", amount: -12, pot_id: null }),
        tx({ booked_on: "2026-10-15", amount: -900, pot_id: "huur" }),
        tx({ booked_on: "2026-10-16", amount: 2500 }),
        tx({ booked_on: "2026-10-10", amount: -20, pot_id: "p" }),
        tx({ booked_on: "2026-10-01", amount: -99, pot_id: "p" }),
      ],
      potjes,
      new Date(2026, 9, 20, 12),
    );
    expect(w.dagen.map((d) => d.datum)).toEqual([
      "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20",
    ]);
    expect(w.dagen[0].bedrag).toBe(12);
    expect(w.dagen[6].bedrag).toBe(30);
    expect(w.totaal).toBe(42);
    expect(w.vasteLasten).toBe(900);
    expect(w.potten).toEqual([
      { pot: potjes[0], deze: 30, vorige: 20 },
      { pot: null, deze: 12, vorige: 0 },
    ]);
    // Rent is listed (it left the account), income is not.
    expect(w.transacties.map((t) => t.amount).sort()).toEqual([-12, -30, -900].sort());
  });
});

describe("dubbeleAfschrijvingen", () => {
  it("pairs the same party and amount within 3 days, and skips small or dismissed ones", () => {
    const a = tx({ id: "a", booked_on: "2026-10-01", amount: -42.95, counterparty: "Anytime Fitness" });
    const b = tx({ id: "b", booked_on: "2026-10-03", amount: -42.95, counterparty: "anytime  fitness" });
    const later = tx({ id: "c", booked_on: "2026-10-20", amount: -42.95, counterparty: "Anytime Fitness" });
    const koffie1 = tx({ id: "k1", booked_on: "2026-10-01", amount: -3.1, counterparty: "Koffiebar" });
    const koffie2 = tx({ id: "k2", booked_on: "2026-10-01", amount: -3.1, counterparty: "Koffiebar" });
    const ander = tx({ id: "d", booked_on: "2026-10-02", amount: -42.94, counterparty: "Anytime Fitness" });
    const paren = dubbeleAfschrijvingen([a, b, later, koffie1, koffie2, ander]);
    expect(paren.map((p) => p.sleutel)).toEqual(["a|b"]);
    expect(paren[0].dagen).toBe(2);
    expect(dubbeleAfschrijvingen([a, b], new Set(["a|b"]))).toEqual([]);
  });
});

describe("verdeling", () => {
  it("adds spending per group and treats unspent income as kept", () => {
    const potjes = [
      pot({ id: "huur", monthly_limit: 1000, groep: "nodig" }),
      pot({ id: "eten", monthly_limit: 300, groep: "wil" }),
      pot({ id: "spaar", monthly_limit: 200, groep: "sparen" }),
      pot({ id: "los", monthly_limit: 50 }),
    ];
    const v = verdeling(potjes, { huur: 1000, eten: 150, spaar: 200, los: 20 }, 3000);
    expect(v.per).toEqual({ nodig: 1000, wil: 150, sparen: 200, zonder: 20 });
    expect(v.uitgegeven).toBe(1370);
    expect(v.over).toBe(1630);
    expect(v.totaalBudget).toBe(1550);
    expect(v.zonderGroep.map((p) => p.id)).toEqual(["los"]);
  });

  it("counts a running month at what the pots are set to take", () => {
    const potjes = [
      pot({ id: "hypotheek", monthly_limit: 1275, kind: "vast", groep: "nodig" }),
      pot({ id: "boodschappen", monthly_limit: 400, groep: "nodig" }),
      pot({ id: "uit", monthly_limit: 150, groep: "wil" }),
    ];
    // The 10th: mortgage not paid yet, groceries partly, eating out already over.
    const v = verdeling(potjes, { boodschappen: 98, uit: 180 }, 4000, { plan: true });
    expect(v.per).toEqual({ nodig: 1675, wil: 180, sparen: 0, zonder: 0 });
    expect(v.over).toBe(4000 - 1855);
  });
});

describe("inkomenPerMaand", () => {
  it("gives one salary a month for a monthly payday", () => {
    const loon = ["2026-07-24", "2026-08-25", "2026-09-24"].map((d) => tx({ booked_on: d, amount: 2400, soort: "inkomen" }));
    const { perMaand } = inkomenPerMaand(loon, new Date(2026, 9, 7, 12));
    expect(perMaand).toBeGreaterThan(2300);
    expect(perMaand).toBeLessThan(2500);
  });

  it("turns a weekly salary into a steady monthly figure", () => {
    // 13 weekly paydays of 500 over the last 91 days.
    const nu = new Date(2026, 9, 7, 12);
    const loon = Array.from({ length: 13 }, (_, i) => {
      const d = new Date(2026, 9, 7 - i * 7);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return tx({ booked_on: iso, amount: 500, soort: "inkomen" });
    });
    const { perMaand } = inkomenPerMaand([...loon, tx({ booked_on: "2026-10-01", amount: 300 })], nu);
    // 500 × 52 / 12 = 2167.
    expect(perMaand).toBeGreaterThan(2150);
    expect(perMaand).toBeLessThan(2185);
  });

  it("works with little history, and needs two paydays", () => {
    const nu = new Date(2026, 9, 7, 12);
    const kort = [
      tx({ booked_on: "2026-09-09", amount: 500, soort: "inkomen" }),
      tx({ booked_on: "2026-09-16", amount: 500, soort: "inkomen" }),
      tx({ booked_on: "2026-09-23", amount: 500, soort: "inkomen" }),
      tx({ booked_on: "2026-09-30", amount: 500, soort: "inkomen" }),
      tx({ booked_on: "2026-10-07", amount: 500, soort: "inkomen" }),
    ];
    // Only 5 weeks of history still gives the same monthly figure.
    expect(inkomenPerMaand(kort, nu).perMaand).toBeGreaterThan(2150);
    expect(inkomenPerMaand(kort, nu).perMaand).toBeLessThan(2185);
    expect(inkomenPerMaand(kort.slice(0, 1), new Date(2026, 8, 12)).perMaand).toBe(0);
  });
});

describe("voorstelVoor", () => {
  const zichtbaar = new Set(["p1", "p2"]);
  const regels = [{ counterparty: "albert heijn", pot_id: "p1" }];
  it("prefers the household's own rule over Claude", () => {
    const v = voorstelVoor(tx({ counterparty: "Albert Heijn", ai_pot_id: "p2", ai_zeker: 0.99 }), regels, zichtbaar);
    expect(v).toEqual({ bron: "regel", potId: "p1", soort: null, zeker: null });
  });
  it("uses Claude only when sure enough, visible, and income only for money in", () => {
    expect(voorstelVoor(tx({ counterparty: "Kapper", ai_pot_id: "p2", ai_zeker: 0.8 }), regels, zichtbaar)?.potId).toBe("p2");
    expect(voorstelVoor(tx({ counterparty: "Kapper", ai_pot_id: "p2", ai_zeker: 0.3 }), regels, zichtbaar)).toBeNull();
    expect(voorstelVoor(tx({ counterparty: "Kapper", ai_pot_id: "privé", ai_zeker: 0.9 }), regels, zichtbaar)).toBeNull();
    expect(voorstelVoor(tx({ counterparty: "Werk", amount: 500, ai_soort: "inkomen", ai_zeker: 0.9 }), regels, zichtbaar)?.soort).toBe("inkomen");
    expect(voorstelVoor(tx({ counterparty: "Werk", amount: -5, ai_soort: "inkomen", ai_zeker: 0.9 }), regels, zichtbaar)).toBeNull();
  });
});
