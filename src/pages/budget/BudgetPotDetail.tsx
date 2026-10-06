// src/pages/budget/BudgetPotDetail.tsx — one pot: this month, its pace, its history
import { useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Lock, Pencil, Receipt } from "lucide-react";
import { useBedragen } from "@/features/budget/components/Bedrag";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { MaandGrafiek } from "@/features/budget/components/MaandGrafiek";
import { Meter, PotStatusRegel } from "@/features/budget/components/PotMeter";
import { PotSheet } from "@/features/budget/components/PotSheet";
import { Kaart, Knop, MaandKiezer, Pagina, Sectie } from "@/features/budget/components/ui";
import {
  usePotjes,
  usePotTransacties,
  useUitgavenHistorie,
  useUitgavenPerPotje,
} from "@/features/budget/hooks/useBudget";
import {
  huidigeMaand,
  isZelfdeMaand,
  maandVoortgang,
  resterendeDagen,
} from "@/features/budget/lib/budget";

const dag = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(iso),
  );

export default function BudgetPotDetail() {
  const { potId } = useParams();
  const navigate = useNavigate();
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const hhId = huishouden.household.id;
  const { euro, euroRond } = useBedragen();
  const [maand, setMaand] = useState(huidigeMaand);
  const [bewerken, setBewerken] = useState(false);
  const { data: potjes = [], isLoading } = usePotjes(hhId);
  const { data: uitgaven = {} } = useUitgavenPerPotje(hhId, maand);
  const { data: historie = [] } = useUitgavenHistorie(hhId, maand, 6);
  const { data: transacties = [] } = usePotTransacties(potId, maand);
  const pot = potjes.find((p) => p.id === potId);

  const cijfers = useMemo(() => {
    if (!pot) return null;
    const reeks = historie.map((h) => h.perPot[pot.id] ?? 0);
    const vorige = reeks.length >= 2 ? reeks[reeks.length - 2] : 0;
    const eerdere = reeks.slice(0, -1).filter((b) => b > 0);
    const gemiddeld = eerdere.length ? eerdere.reduce((s, b) => s + b, 0) / eerdere.length : null;
    return { vorige, gemiddeld };
  }, [historie, pot]);

  if (!isLoading && !pot) {
    return (
      <Pagina titel="Potje niet gevonden" terug={{ naar: "/budget/overzicht", label: "Overzicht" }}>
        <p className="text-sm text-kb-ink2">
          Dit potje bestaat niet meer, of hoort bij een ander huishouden.
        </p>
      </Pagina>
    );
  }
  if (!pot || !cijfers) return null;

  const uit = uitgaven[pot.id] ?? 0;
  const rest = pot.monthly_limit - uit;
  const ditIsNu = isZelfdeMaand(maand, huidigeMaand());
  const dagen = resterendeDagen(maand);
  const volgende = potjes.reduce((m, p) => Math.max(m, p.sort_order), 0) + 1;

  return (
    <Pagina
      terug={{ naar: "/budget/overzicht", label: "Overzicht" }}
      titel={
        <span className="flex items-center gap-2.5">
          <span aria-hidden="true">{pot.emoji}</span>
          <span className="truncate">{pot.name}</span>
        </span>
      }
      sub={
        pot.scope === "personal" ? (
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" /> Persoonlijk · alleen jij ziet dit potje
          </span>
        ) : (
          "Gedeeld potje"
        )
      }
      actie={
        <Knop variant="rustig" onClick={() => setBewerken(true)} className="shrink-0">
          <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Bewerken</span>
        </Knop>
      }
    >
      <div className="max-w-2xl space-y-7">
        <div className="-mt-2 flex justify-center sm:justify-start">
          <MaandKiezer maand={maand} onChange={setMaand} />
        </div>

        <Kaart className="p-5 sm:p-6">
          <p className="text-sm text-kb-ink2">{rest < 0 ? "Te veel uitgegeven" : "Nog over"}</p>
          <p
            className={`mt-1 text-5xl font-semibold leading-none tracking-tight ${rest < 0 ? "text-kb-crit-ink" : ""}`}
          >
            {euro(Math.abs(rest))}
          </p>
          <p className="mt-2 text-sm text-kb-ink2">
            {euro(uit)} van {euroRond(pot.monthly_limit)} uitgegeven
          </p>
          <div className="mt-5">
            <Meter
              dik
              uitgegeven={uit}
              limiet={pot.monthly_limit}
              tempo={ditIsNu ? maandVoortgang(maand) : undefined}
              vast={pot.kind === "vast"}
              label={`${pot.name}: ${euro(uit)} van ${euroRond(pot.monthly_limit)}`}
            />
          </div>
          <div className="mt-2.5">
            <PotStatusRegel pot={pot} uitgegeven={uit} maand={maand} />
          </div>
        </Kaart>

        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Per dag nog",
              waarde: dagen > 0 && rest > 0 ? euro(rest / dagen) : "—",
            },
            { label: "Vorige maand", waarde: euroRond(cijfers.vorige) },
            {
              label: "Gemiddeld",
              waarde: cijfers.gemiddeld !== null ? euroRond(cijfers.gemiddeld) : "—",
              hint: "per maand, laatste 5",
            },
          ].map((t) => (
            <Kaart key={t.label} className="px-3.5 py-3">
              <p className="text-xs text-kb-ink2">{t.label}</p>
              <p className="mt-1 text-lg font-semibold tracking-tight">{t.waarde}</p>
              {t.hint && <p className="text-[0.68rem] text-kb-ink3">{t.hint}</p>}
            </Kaart>
          ))}
        </div>

        <Sectie titel="Laatste 6 maanden">
          <Kaart className="p-5">
            <MaandGrafiek
              punten={historie.map((h) => ({ maand: h.maand, bedrag: h.perPot[pot.id] ?? 0 }))}
              limiet={pot.monthly_limit}
            />
          </Kaart>
        </Sectie>

        <Sectie titel="Transacties">
          {transacties.length === 0 ? (
            <Kaart className="flex items-center gap-3 px-4 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-kb-sunk text-kb-ink2">
                <Receipt className="h-4 w-4" />
              </span>
              <p className="text-sm text-kb-ink2">
                Nog niets in dit potje deze maand. Na het koppelen van ING komen je uitgaven hier
                vanzelf binnen.
              </p>
            </Kaart>
          ) : (
            <Kaart className="divide-y divide-kb-line overflow-hidden">
              {transacties.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.counterparty ?? t.description ?? "Onbekend"}</p>
                    <p className="text-xs text-kb-ink2 first-letter:uppercase">{dag(t.booked_on)}</p>
                  </div>
                  <p
                    className={`text-sm font-medium tabular-nums ${t.amount > 0 ? "text-kb-good-ink" : ""}`}
                  >
                    {t.amount > 0 ? "+" : "−"}
                    {euro(Math.abs(t.amount))}
                  </p>
                </div>
              ))}
            </Kaart>
          )}
        </Sectie>
      </div>

      <PotSheet
        open={bewerken}
        onOpenChange={setBewerken}
        householdId={hhId}
        pot={pot}
        volgendeSortering={volgende}
        onVerwijderd={() => navigate("/budget/overzicht", { replace: true })}
      />
    </Pagina>
  );
}
