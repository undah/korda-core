// src/pages/budget/BudgetMeldingen.tsx — which notifications you get.
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { BellOff } from "lucide-react";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { Kaart, Pagina, Sectie, foutTekst } from "@/features/budget/components/ui";
import { useMeldingVoorkeuren, useZetMeldingType } from "@/features/budget/hooks/useBudgetData";
import { meldingenAan } from "@/features/budget/lib/meldingen";
import { MELDING_TYPEN } from "@/features/budget/lib/meldingTypen";

export default function BudgetMeldingen() {
  useOutletContext<BudgetOutletContext>();
  const { data: uit = [] } = useMeldingVoorkeuren();
  const zet = useZetMeldingType();
  const groepen = [...new Set(MELDING_TYPEN.map((t) => t.groep))];

  return (
    <Pagina titel="Meldingen" terug={{ naar: "/budget/meer", label: "Meer" }}>
      <div className="max-w-2xl space-y-6">
        {!meldingenAan() && (
          <Kaart className="flex items-start gap-3 px-4 py-3.5 text-sm text-kb-ink2">
            <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Meldingen staan op dit apparaat nog uit. Zet ze aan onder Meer, bij Meldingen op dit apparaat. Wat je hier
              kiest, geldt voor al je apparaten.
            </span>
          </Kaart>
        )}
        {groepen.map((g) => (
          <Sectie key={g} titel={g}>
            <Kaart className="divide-y divide-kb-line overflow-hidden">
              {MELDING_TYPEN.filter((t) => t.groep === g).map((t) => {
                const aan = !uit.includes(t.id);
                return (
                  <label key={t.id} className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{t.titel}</span>
                      <span className="block text-xs text-kb-ink2">{t.uitleg}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={aan}
                      disabled={zet.isPending}
                      onChange={(e) => zet.mutate({ type: t.id, aan: e.target.checked }, { onError: (err) => toast.error(foutTekst(err)) })}
                      className="h-5 w-5 accent-kb-accent"
                      aria-label={`${t.titel} ${aan ? "uitzetten" : "aanzetten"}`}
                    />
                  </label>
                );
              })}
            </Kaart>
          </Sectie>
        ))}
        <p className="px-1 text-xs text-kb-ink3">Elke melding komt hooguit één keer, en alleen over wat jij in KordaBudget kunt zien.</p>
      </div>
    </Pagina>
  );
}
