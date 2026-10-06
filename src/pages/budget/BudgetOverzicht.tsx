// src/pages/budget/BudgetOverzicht.tsx — this month at a glance
import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ChevronLeft, ChevronRight, Landmark, PiggyBank } from "lucide-react";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { PotMeter } from "@/features/budget/components/PotMeter";
import { Kaart, Knop, Pagina } from "@/features/budget/components/ui";
import { usePotjes, useUitgavenPerPotje } from "@/features/budget/hooks/useBudget";
import {
  formatEuro,
  formatEuroRond,
  huidigeMaand,
  isZelfdeMaand,
  maandNaam,
  maandVoortgang,
  potStatus,
  verschuifMaand,
} from "@/features/budget/lib/budget";

export default function BudgetOverzicht() {
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const hhId = huishouden.household.id;
  const navigate = useNavigate();
  const [maand, setMaand] = useState(huidigeMaand);
  const { data: potjes = [], isLoading } = usePotjes(hhId);
  const { data: uitgaven = {} } = useUitgavenPerPotje(hhId, maand);
  const ditIsNu = isZelfdeMaand(maand, huidigeMaand());
  const tempo = ditIsNu ? maandVoortgang(maand) : undefined;

  const totaal = useMemo(() => {
    const limiet = potjes.reduce((s, p) => s + p.monthly_limit, 0);
    const uit = potjes.reduce((s, p) => s + (uitgaven[p.id] ?? 0), 0);
    const aandacht = potjes.filter((p) => potStatus(uitgaven[p.id] ?? 0, p.monthly_limit) !== "ok");
    return { limiet, uit, over: limiet - uit, aandacht };
  }, [potjes, uitgaven]);

  const gedeeld = potjes.filter((p) => p.scope === "shared");
  const persoonlijk = potjes.filter((p) => p.scope === "personal");

  return (
    <Pagina
      titel={`Hoi ${huishouden.me.display_name}`}
      sub={huishouden.household.name}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Kaart className="p-5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Vorige maand"
                onClick={() => setMaand((m) => verschuifMaand(m, -1))}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#5c5c58] hover:bg-[#f0f0ec]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="text-sm font-medium capitalize">{maandNaam(maand)}</p>
              <button
                type="button"
                aria-label="Volgende maand"
                onClick={() => setMaand((m) => verschuifMaand(m, 1))}
                disabled={ditIsNu}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#5c5c58] hover:bg-[#f0f0ec] disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm text-[#5c5c58]">
                {totaal.over >= 0 ? "Nog te besteden" : "Over budget"}
              </p>
              {/* The one hero figure on this screen. */}
              <p className="mt-1 text-5xl font-semibold tracking-tight">
                {formatEuroRond(Math.abs(totaal.over))}
              </p>
              <p className="mt-2 text-sm tabular-nums text-[#5c5c58]">
                {formatEuro(totaal.uit)} van {formatEuroRond(totaal.limiet)} uitgegeven
              </p>
              {totaal.aandacht.length > 0 && (
                <p className="mt-2 text-xs text-[#5c5c58]">
                  {totaal.aandacht.length === 1
                    ? "1 potje vraagt aandacht"
                    : `${totaal.aandacht.length} potjes vragen aandacht`}
                </p>
              )}
            </div>
          </Kaart>

          {!isLoading && potjes.length === 0 ? (
            <Kaart className="px-6 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e3eafb] text-[#1d46b0]">
                <PiggyBank className="h-5 w-5" />
              </div>
              <p className="mt-4 font-medium">Nog geen potjes</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-[#5c5c58]">
                Verdeel je maandbudget over potjes zoals boodschappen en vaste lasten.
              </p>
              <Knop className="mt-5" onClick={() => navigate("/budget/potjes")}>
                Potjes instellen
              </Knop>
            </Kaart>
          ) : (
            <>
              {[
                { titel: "Gedeeld", lijst: gedeeld },
                { titel: "Persoonlijk", lijst: persoonlijk },
              ]
                .filter((g) => g.lijst.length > 0)
                .map((g) => (
                  <div key={g.titel}>
                    <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[#6b6b66]">
                      {g.titel}
                    </h2>
                    <Kaart className="divide-y divide-[#ececE7] overflow-hidden">
                      {g.lijst.map((p) => (
                        <PotMeter key={p.id} pot={p} uitgegeven={uitgaven[p.id] ?? 0} tempo={tempo} />
                      ))}
                    </Kaart>
                  </div>
                ))}
              {tempo !== undefined && potjes.length > 0 && (
                <p className="px-1 text-xs text-[#6b6b66]">
                  Het streepje in elke balk staat waar je zou zitten als je gelijkmatig over de
                  maand uitgeeft.
                </p>
              )}
            </>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-10">
          <Kaart className="p-5">
            <div className="flex items-center gap-2 text-[#1d46b0]">
              <Landmark className="h-4 w-4" strokeWidth={1.75} />
              <p className="text-sm font-semibold">ING koppelen</p>
            </div>
            <p className="mt-2 text-sm text-[#5c5c58]">
              Zodra je rekeningen gekoppeld zijn, vullen de potjes zich vanzelf met je uitgaven.
            </p>
            <p className="mt-3 text-xs font-medium text-[#6b6b66]">Komt in de volgende stap</p>
          </Kaart>
        </aside>
      </div>
    </Pagina>
  );
}
