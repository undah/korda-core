// src/pages/budget/BudgetOverzicht.tsx — this month at a glance
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { AlertOctagon, AlertTriangle, ChevronRight, Landmark, PiggyBank, TrendingUp, UserPlus } from "lucide-react";
import { useBedragen } from "@/features/budget/components/Bedrag";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { PotTegel, potSignaal } from "@/features/budget/components/PotMeter";
import { Avatars, Kaart, Knop, MaandKiezer, Pagina, Sectie } from "@/features/budget/components/ui";
import { usePotjes, useUitgavenPerPotje } from "@/features/budget/hooks/useBudget";
import { useRekeningen, useTransacties, useVasteLasten } from "@/features/budget/hooks/useBudgetData";
import {
  KomtEraanKaart,
  MaandAfsluiting,
  VerrekenKaart,
  WeekKaart,
} from "@/features/budget/components/OverzichtKaarten";
import { komtEraan, vasteLastenDezeMaand, veiligeRuimte, weekoverzicht } from "@/features/budget/lib/inzicht";
import { meldEenmalig, weekSleutel } from "@/features/budget/lib/meldingen";
import {
  huidigeMaand,
  isZelfdeMaand,
  korteDatum,
  maandVoortgang,
} from "@/features/budget/lib/budget";
import type { BudgetMonth, BudgetPot } from "@/features/budget/types";

function begroeting(nu = new Date()) {
  const uur = nu.getHours();
  if (uur < 6) return "Goedenacht";
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

export default function BudgetOverzicht() {
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const hhId = huishouden.household.id;
  const navigate = useNavigate();
  const [maand, setMaand] = useState(huidigeMaand);
  const { data: potjes = [], isLoading } = usePotjes(hhId);
  const { data: rekeningen, isLoading: rekeningenLaden } = useRekeningen(hhId);
  // Ask to link ING only until the household has a bank account it can see.
  const heeftBank = rekeningenLaden || !!rekeningen?.some((r) => r.provider === "enable_banking");
  const { data: uitgaven = {} } = useUitgavenPerPotje(hhId, maand);
  const ditIsNu = isZelfdeMaand(maand, huidigeMaand());
  const tempo = ditIsNu ? maandVoortgang(maand) : undefined;
  const { data: lasten = [] } = useVasteLasten(hhId);
  const { data: maandTx = [] } = useTransacties(hhId, maand);
  const { data: recenteTx = [] } = useTransacties(hhId, huidigeMaand(), 2);
  const aankomend = useMemo(
    () => (ditIsNu ? komtEraan(vasteLastenDezeMaand(lasten, maandTx, maand)) : []),
    [ditIsNu, lasten, maandTx, maand],
  );
  const ruimte = useMemo(
    () => veiligeRuimte(potjes, uitgaven, aankomend, maand),
    [potjes, uitgaven, aankomend, maand],
  );

  const totaal = useMemo(() => {
    const limiet = potjes.reduce((s, p) => s + p.monthly_limit, 0);
    const uit = potjes.reduce((s, p) => s + (uitgaven[p.id] ?? 0), 0);
    return { limiet, uit, over: limiet - uit };
  }, [potjes, uitgaven]);

  // Worst first: over the limit, then nearly empty, then "will run out early".
  const aandacht = useMemo(() => {
    const gewicht = { over: 0, bijna: 1, ok: 2 } as const;
    return potjes
      .map((p) => ({ pot: p, uit: uitgaven[p.id] ?? 0, ...potSignaal(uitgaven[p.id] ?? 0, p, maand) }))
      .filter((r) => r.status !== "ok" || r.opDag)
      .sort((a, b) => gewicht[a.status] - gewicht[b.status] || (a.opDag ?? 99) - (b.opDag ?? 99));
  }, [potjes, uitgaven, maand]);

  // Local notifications: a pot crossing 80% or its limit (once per pot per month),
  // and on Sundays a weekly recap (once per week). Shown when the app is opened.
  useEffect(() => {
    if (!ditIsNu || potjes.length === 0) return;
    const m = `${maand.year}-${maand.month}`;
    for (const r of aandacht) {
      const url = `/budget/potjes/${r.pot.id}`;
      if (r.status === "over")
        meldEenmalig(`${r.pot.id}:${m}:over`, `${r.pot.emoji} ${r.pot.name} is over de limiet`, "Kijk in KordaBudget wat er nog kan.", url);
      else if (r.status === "bijna")
        meldEenmalig(`${r.pot.id}:${m}:bijna`, `${r.pot.emoji} ${r.pot.name} is bijna op`, "Je zit boven de 80% van de limiet.", url);
    }
    const w = weekoverzicht(recenteTx, potjes);
    if (w.deze > 0 && new Date().getDay() === 0) {
      const vergelijk = w.vorige > 0 ? `, ${w.verschil > 0 ? "meer" : "minder"} dan vorige week` : "";
      meldEenmalig(
        `week:${huishouden.household.id}:${weekSleutel()}`,
        "Je week in KordaBudget",
        `€ ${Math.round(w.deze)} uitgegeven${vergelijk}.`,
      );
    }
  }, [ditIsNu, aandacht, recenteTx, potjes, maand, huishouden.household.id]);

  const gesorteerd = [...potjes].sort((a, b) =>
    a.scope === b.scope ? a.sort_order - b.sort_order : a.scope === "shared" ? -1 : 1,
  );

  return (
    <Pagina titel={`${begroeting()}, ${huishouden.me.display_name}`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="min-w-0 space-y-7">
          <div className="-mt-3 flex justify-center sm:justify-start">
            <MaandKiezer maand={maand} onChange={setMaand} />
          </div>

          {!isLoading && potjes.length === 0 ? (
            <Kaart className="px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-kb-accent-soft text-kb-accent-ink">
                <PiggyBank className="h-6 w-6" />
              </div>
              <p className="mt-4 text-lg font-semibold tracking-tight">Verdeel je eerste maand</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-kb-ink2">
                Geef boodschappen, vaste lasten en de rest elk een potje met een limiet. Dan zie je
                hier elke dag hoeveel je veilig kunt uitgeven.
              </p>
              <Knop className="mt-6" onClick={() => navigate("/budget/potjes")}>
                Potjes instellen
              </Knop>
            </Kaart>
          ) : (
            <HeldKaart totaal={totaal} tempo={tempo} ruimte={ruimte} />
          )}

          {ditIsNu && <MaandAfsluiting huishouden={huishouden} />}
          {ditIsNu && <VerrekenKaart huishouden={huishouden} />}

          {aandacht.length > 0 && (
            <Sectie titel="Let op">
              <Kaart className="divide-y divide-kb-line overflow-hidden">
                {aandacht.slice(0, 4).map((r) => (
                  <AandachtRij key={r.pot.id} pot={r.pot} maand={maand} {...r} />
                ))}
              </Kaart>
            </Sectie>
          )}

          {potjes.length > 0 && (
            <Sectie
              titel="Potjes"
              aside={
                <Link to="/budget/potjes" className="text-xs font-medium text-kb-accent-ink hover:underline">
                  Beheren
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gesorteerd.map((p) => (
                  <PotTegel
                    key={p.id}
                    pot={p}
                    uitgegeven={uitgaven[p.id] ?? 0}
                    maand={maand}
                    tempo={tempo}
                    onClick={() => navigate(`/budget/potjes/${p.id}`)}
                  />
                ))}
              </div>
              {tempo !== undefined && (
                <p className="mt-3 px-1 text-xs text-kb-ink2">
                  Het streepje in een balk is waar je zou zitten als je gelijkmatig over de maand
                  uitgeeft.
                </p>
              )}
            </Sectie>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-10">
          <KomtEraanKaart aankomend={aankomend} />
          <WeekKaart transacties={recenteTx} potjes={potjes} />
          <Kaart className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{huishouden.household.name}</p>
              <Avatars leden={huishouden.members} />
            </div>
            <p className="mt-1 text-sm text-kb-ink2">
              {huishouden.members.map((m) => m.display_name).join(" en ")}
            </p>
            {huishouden.members.length === 1 && (
              <Link
                to="/budget/meer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-kb-accent-ink hover:underline"
              >
                <UserPlus className="h-4 w-4" /> Partner uitnodigen
              </Link>
            )}
          </Kaart>
          {!heeftBank && (
            <Link
              to="/budget/rekeningen"
              className="flex items-center gap-3 rounded-2xl border border-kb-line bg-kb-surface p-4 hover:bg-kb-sunk/60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-kb-accent-soft text-kb-accent-ink">
                <Landmark className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">ING koppelen</span>
                <span className="block text-xs text-kb-ink2">
                  Dan vullen de potjes zich vanzelf met je uitgaven.
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-kb-ink3" />
            </Link>
          )}
        </aside>
      </div>
    </Pagina>
  );
}

/** The one dark card: the number that answers "can I spend this?". */
function HeldKaart({
  totaal,
  tempo,
  ruimte,
}: {
  totaal: { limiet: number; uit: number; over: number };
  tempo?: number;
  ruimte: ReturnType<typeof veiligeRuimte>;
}) {
  const { euro, euroRond } = useBedragen();
  const { perDag, dagen, vrij, gereserveerd } = ruimte;
  const verbruikt = totaal.limiet > 0 ? Math.min(1, totaal.uit / totaal.limiet) : 0;
  const tekort = totaal.over < 0;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-kb-ink px-5 pb-5 pt-6 text-white sm:px-7 sm:pt-7">
      {/* Quiet depth, no decoration that competes with the number. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-kb-accent/35 blur-3xl"
      />
      <div className="relative">
        <p className="text-sm text-white/70">
          {perDag !== null ? "Veilig te besteden per dag" : tekort ? "Deze maand te veel uitgegeven" : "Deze maand over"}
        </p>
        <p className="mt-1 text-[3.25rem] font-semibold leading-none tracking-tight sm:text-6xl">
          {perDag !== null ? euroRond(perDag) : euroRond(Math.abs(totaal.over))}
        </p>
        <p className="mt-3 text-sm text-white/75">
          {perDag !== null
            ? `${euroRond(vrij)} vrij voor nog ${dagen} ${dagen === 1 ? "dag" : "dagen"}`
            : `${euro(totaal.uit)} van ${euroRond(totaal.limiet)} uitgegeven`}
        </p>
        {perDag !== null && gereserveerd > 0 && (
          <p className="mt-1 text-xs text-white/60">
            {euroRond(gereserveerd)} is al gereserveerd voor vaste lasten die nog komen
          </p>
        )}

        <div className="relative mt-7">
          {tempo !== undefined && tempo > 0 && tempo < 1 && (
            // "Today" sits above the bar so it stays readable on both fill and track,
            // and doesn't borrow a status colour.
            <span
              aria-hidden="true"
              className="absolute -top-2.5 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-white/80"
              style={{ left: `${tempo * 100}%` }}
            />
          )}
          <div
            role="meter"
            aria-label={`Maandbudget: ${euro(totaal.uit)} van ${euroRond(totaal.limiet)} uitgegeven`}
            aria-valuemin={0}
            aria-valuemax={totaal.limiet}
            aria-valuenow={Math.min(totaal.uit, totaal.limiet)}
            className="h-2.5 overflow-hidden rounded-full bg-white/15"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-out ${tekort ? "bg-kb-crit" : "bg-white"}`}
              style={{ width: `${verbruikt * 100}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-white/70">
            <span>{euro(totaal.uit)} uitgegeven</span>
            <span>
              {tempo !== undefined && <span className="mr-3">▾ vandaag</span>}
              budget {euroRond(totaal.limiet)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function AandachtRij({
  pot,
  uit,
  status,
  opDag,
  maand,
}: {
  pot: BudgetPot;
  uit: number;
  status: "ok" | "bijna" | "over";
  opDag: number | null;
  maand: BudgetMonth;
}) {
  const { euro } = useBedragen();
  const navigate = useNavigate();
  const rest = pot.monthly_limit - uit;
  const [Icoon, kleur, tekst] =
    status === "over"
      ? [AlertOctagon, "text-kb-crit-ink bg-kb-crit-soft", `${euro(-rest)} over de limiet`]
      : status === "bijna"
        ? [AlertTriangle, "text-kb-warn-ink bg-kb-warn-soft", rest < 0.005 ? "Helemaal op" : `Bijna op · nog ${euro(rest)}`]
        : [TrendingUp, "text-kb-warn-ink bg-kb-warn-soft", `Leeg op ${korteDatum(maand, opDag!)} bij dit tempo`];

  return (
    <button
      type="button"
      onClick={() => navigate(`/budget/potjes/${pot.id}`)}
      className="flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-kb-sunk/60"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${kleur}`}>
        <Icoon className="h-[1.1rem] w-[1.1rem]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {pot.emoji} {pot.name}
        </span>
        <span className="block text-xs text-kb-ink2">{tekst}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-kb-ink3" />
    </button>
  );
}
