// src/pages/budget/BudgetPotjes.tsx — manage the household's pots
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { Check, ChevronRight, Plus } from "lucide-react";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { PotSheet } from "@/features/budget/components/PotSheet";
import { Kaart, Knop, Pagina, foutTekst } from "@/features/budget/components/ui";
import { usePotjes, useVoegPotjesToe } from "@/features/budget/hooks/useBudget";
import { VOORGESTELDE_POTJES, formatEuroRond } from "@/features/budget/lib/budget";
import type { BudgetPot } from "@/features/budget/types";

export default function BudgetPotjes() {
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const hhId = huishouden.household.id;
  const { data: potjes = [], isLoading } = usePotjes(hhId);
  const [sheet, setSheet] = useState<{ open: boolean; pot?: BudgetPot }>({ open: false });
  const volgende = potjes.reduce((m, p) => Math.max(m, p.sort_order), 0) + 1;

  const groepen = [
    { titel: "Gedeeld", lijst: potjes.filter((p) => p.scope === "shared") },
    { titel: "Persoonlijk", lijst: potjes.filter((p) => p.scope === "personal") },
  ].filter((g) => g.lijst.length > 0);

  return (
    <Pagina
      titel="Potjes"
      sub={
        potjes.length > 0
          ? `${formatEuroRond(potjes.reduce((s, p) => s + p.monthly_limit, 0))} per maand verdeeld`
          : "Verdeel je maandbudget"
      }
      actie={
        <Knop onClick={() => setSheet({ open: true })} className="shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nieuw potje</span>
          <span className="sm:hidden">Nieuw</span>
        </Knop>
      }
    >
      <div className="max-w-2xl space-y-6">
        {!isLoading && potjes.length === 0 && (
          <Startpakket householdId={hhId} />
        )}

        {groepen.map((g) => (
          <div key={g.titel}>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6b6b66]">{g.titel}</h2>
              <p className="text-xs tabular-nums text-[#6b6b66]">
                {formatEuroRond(g.lijst.reduce((s, p) => s + p.monthly_limit, 0))}
              </p>
            </div>
            <Kaart className="divide-y divide-[#ececE7] overflow-hidden">
              {g.lijst.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSheet({ open: true, pot: p })}
                  className="flex min-h-[3.5rem] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-[#f6f6f2]"
                >
                  <span aria-hidden="true" className="text-xl">
                    {p.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.95rem] font-medium">{p.name}</span>
                  <span className="text-sm tabular-nums text-[#5c5c58]">
                    {formatEuroRond(p.monthly_limit)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#a3a39d]" />
                </button>
              ))}
            </Kaart>
          </div>
        ))}

        {potjes.length > 0 && (
          <p className="px-1 text-xs text-[#6b6b66]">
            Persoonlijke potjes ziet alleen jij. Wat aan het eind van de maand over is, gaat naar
            sparen.
          </p>
        )}
      </div>

      <PotSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        householdId={hhId}
        pot={sheet.pot}
        volgendeSortering={volgende}
      />
    </Pagina>
  );
}

/** Empty household: pick a set of common pots in one go instead of building them one by one. */
function Startpakket({ householdId }: { householdId: string }) {
  const [gekozen, setGekozen] = useState<Set<string>>(
    () => new Set(VOORGESTELDE_POTJES.slice(0, 5).map((p) => p.name)),
  );
  const voegToe = useVoegPotjesToe(householdId);

  const wissel = (naam: string) =>
    setGekozen((s) => {
      const n = new Set(s);
      if (n.has(naam)) n.delete(naam);
      else n.add(naam);
      return n;
    });

  const bevestig = async () => {
    const rijen = VOORGESTELDE_POTJES.filter((p) => gekozen.has(p.name)).map((p, i) => ({
      ...p,
      sort_order: i + 1,
    }));
    try {
      await voegToe.mutateAsync(rijen);
      toast.success(`${rijen.length} potjes toegevoegd — pas de limieten gerust aan`);
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  return (
    <Kaart className="p-5">
      <p className="font-medium">Snel beginnen</p>
      <p className="mt-1 text-sm text-[#5c5c58]">
        Kies de potjes die bij jullie passen. De bedragen zijn een startpunt; je past ze daarna aan.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {VOORGESTELDE_POTJES.map((p) => {
          const aan = gekozen.has(p.name);
          return (
            <li key={p.name}>
              <button
                type="button"
                aria-pressed={aan}
                onClick={() => wissel(p.name)}
                className={`flex min-h-[3rem] w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors ${
                  aan ? "border-[#2a5bd7] bg-[#e3eafb]" : "border-[#d9d9d3] bg-white hover:bg-[#f6f6f2]"
                }`}
              >
                <span aria-hidden="true" className="text-lg">
                  {p.emoji}
                </span>
                <span className="flex-1 text-sm font-medium">{p.name}</span>
                <span className="text-xs tabular-nums text-[#5c5c58]">{formatEuroRond(p.monthly_limit)}</span>
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    aan ? "border-[#2a5bd7] bg-[#2a5bd7] text-white" : "border-[#c9c9c3]"
                  }`}
                >
                  {aan && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Knop className="mt-4 w-full" onClick={bevestig} disabled={gekozen.size === 0 || voegToe.isPending}>
        {gekozen.size === 0 ? "Kies minstens één potje" : `${gekozen.size} potjes toevoegen`}
      </Knop>
    </Kaart>
  );
}
