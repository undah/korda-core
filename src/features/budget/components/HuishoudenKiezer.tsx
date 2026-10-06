// src/features/budget/components/HuishoudenKiezer.tsx — switch between households
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer } from "vaul";
import { Check, ChevronDown, Settings2 } from "lucide-react";
import type { Huishouden } from "../hooks/useBudget";
import { HuishoudenFormulier, type Keuze } from "./BudgetOnboarding";
import { Avatars } from "./ui";

export function HuishoudenKiezer({
  huishoudens,
  actief,
  onKies,
  compact = false,
}: {
  huishoudens: Huishouden[];
  actief: Huishouden;
  onKies: (id: string) => void;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [formulier, setFormulier] = useState<Keuze | null>(null);

  const sluit = () => {
    setOpen(false);
    setFormulier(null);
  };

  return (
    <Drawer.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : sluit())}>
      <Drawer.Trigger asChild>
        <button
          type="button"
          className={`flex min-w-0 items-center gap-2.5 rounded-xl text-left transition-colors hover:bg-kb-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kb-accent ${
            compact ? "-ml-2 px-2 py-1.5" : "w-full px-3 py-2.5"
          }`}
          aria-label={`Huishouden: ${actief.household.name}. Wisselen`}
        >
          <Avatars leden={actief.members} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{actief.household.name}</span>
            {!compact && (
              <span className="block text-xs text-kb-ink2">
                {actief.members.length === 1 ? "Alleen jij" : `${actief.members.length} personen`}
              </span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-kb-ink2" />
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-kb-ink/40" />
        <Drawer.Content className="kb-root fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-kb-surface text-kb-ink outline-none">
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-kb-line-strong" />
          <div className="overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
            <Drawer.Title className="text-lg font-semibold tracking-tight">
              {formulier ? (formulier === "nieuw" ? "Nieuw huishouden" : "Aansluiten met code") : "Huishoudens"}
            </Drawer.Title>
            <Drawer.Description className="mt-1 text-sm text-kb-ink2">
              {formulier
                ? "Na het aanmaken of aansluiten ga je er meteen heen."
                : "Elk huishouden heeft zijn eigen potjes en rekeningen."}
            </Drawer.Description>

            {formulier ? (
              <div className="mt-5">
                <HuishoudenFormulier
                  start={formulier}
                  standaardNaam={actief.me.display_name}
                  onKlaar={(id) => {
                    onKies(id);
                    sluit();
                  }}
                />
                <button
                  type="button"
                  onClick={() => setFormulier(null)}
                  className="mt-3 w-full py-2 text-sm text-kb-ink2 hover:text-kb-ink"
                >
                  Terug naar de lijst
                </button>
              </div>
            ) : (
              <>
                <ul className="mt-4 space-y-1.5">
                  {huishoudens.map((h) => {
                    const isActief = h.household.id === actief.household.id;
                    return (
                      <li key={h.household.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onKies(h.household.id);
                            sluit();
                          }}
                          className={`flex min-h-[3.5rem] w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors ${
                            isActief
                              ? "border-kb-accent bg-kb-accent-soft"
                              : "border-kb-line bg-white hover:bg-kb-sunk"
                          }`}
                        >
                          <Avatars leden={h.members} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{h.household.name}</span>
                            <span className="block text-xs text-kb-ink2">
                              {h.isMaker ? "Aangemaakt door jou" : "Aangesloten"} ·{" "}
                              {h.members.length === 1 ? "1 persoon" : `${h.members.length} personen`}
                            </span>
                          </span>
                          {isActief && <Check className="h-4 w-4 text-kb-accent-ink" strokeWidth={2.5} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormulier("nieuw")}
                    className="min-h-[2.75rem] rounded-xl bg-kb-accent-soft text-sm font-medium text-kb-accent-ink hover:bg-kb-accent-soft/70"
                  >
                    + Nieuw huishouden
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormulier("aansluiten")}
                    className="min-h-[2.75rem] rounded-xl border border-kb-line-strong text-sm font-medium hover:bg-kb-sunk"
                  >
                    Code invullen
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sluit();
                    navigate("/budget/huishoudens");
                  }}
                  className="mt-2 flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl text-sm text-kb-ink2 hover:bg-kb-sunk hover:text-kb-ink"
                >
                  <Settings2 className="h-4 w-4" /> Huishoudens beheren
                </button>
              </>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
