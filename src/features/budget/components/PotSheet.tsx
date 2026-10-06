// src/features/budget/components/PotSheet.tsx — add or edit a pot in a bottom sheet
import { useEffect, useState, type FormEvent } from "react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { useArchiveerPotje, useBewaarPotje, type PotInvoer } from "../hooks/useBudget";
import { formatEuroRond, parseBedrag } from "../lib/budget";
import type { BudgetPot, BudgetScope } from "../types";
import { Knop, Veld, foutTekst } from "./ui";

const EMOJI = ["🛒", "🏠", "🍝", "🚗", "📺", "👕", "🪴", "🎁", "💡", "🐶", "👶", "💊", "🎉", "✈️", "📚", "💶"];

export function PotSheet({
  open,
  onOpenChange,
  householdId,
  pot,
  volgendeSortering,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  /** Omit to create a new pot. */
  pot?: BudgetPot;
  volgendeSortering: number;
}) {
  const [naam, setNaam] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [limiet, setLimiet] = useState("");
  const [scope, setScope] = useState<BudgetScope>("shared");
  const [zekerVerwijderen, setZekerVerwijderen] = useState(false);
  const bewaar = useBewaarPotje(householdId);
  const archiveer = useArchiveerPotje(householdId);

  useEffect(() => {
    if (!open) return;
    setNaam(pot?.name ?? "");
    setEmoji(pot?.emoji ?? EMOJI[0]);
    setLimiet(pot ? String(pot.monthly_limit).replace(".", ",") : "");
    setScope(pot?.scope ?? "shared");
    setZekerVerwijderen(false);
  }, [open, pot]);

  const verstuur = async (e: FormEvent) => {
    e.preventDefault();
    const invoer: PotInvoer = { name: naam, emoji, monthly_limit: parseBedrag(limiet), scope };
    try {
      await bewaar.mutateAsync({ id: pot?.id, invoer, sortOrder: volgendeSortering });
      toast.success(pot ? "Potje bijgewerkt" : "Potje toegevoegd");
      onOpenChange(false);
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  const verwijder = async () => {
    if (!pot) return;
    if (!zekerVerwijderen) {
      setZekerVerwijderen(true);
      return;
    }
    try {
      await archiveer.mutateAsync(pot.id);
      toast.success("Potje verwijderd");
      onOpenChange(false);
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[#1a1a19]/40" />
        <Drawer.Content className="kb-root fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-[#fcfcfb] text-[#1a1a19] outline-none">
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-[#d9d9d3]" />
          <form
            onSubmit={verstuur}
            className="overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4"
          >
            <Drawer.Title className="text-lg font-semibold tracking-tight">
              {pot ? "Potje bewerken" : "Nieuw potje"}
            </Drawer.Title>
            <Drawer.Description className="mt-1 text-sm text-[#5c5c58]">
              Wat over is aan het eind van de maand, gaat naar sparen.
            </Drawer.Description>

            <div className="mt-5 space-y-4">
              <Veld
                label="Naam"
                placeholder="Bijv. Boodschappen"
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                maxLength={40}
                required
              />

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Icoon</legend>
                <div className="grid grid-cols-8 gap-1.5">
                  {EMOJI.map((e) => (
                    <button
                      key={e}
                      type="button"
                      aria-label={`Icoon ${e}`}
                      aria-pressed={emoji === e}
                      onClick={() => setEmoji(e)}
                      className={`flex aspect-square items-center justify-center rounded-xl text-xl transition-colors ${
                        emoji === e ? "bg-[#e3eafb] ring-2 ring-[#2a5bd7]" : "bg-[#f3f3ef] hover:bg-[#ebebe6]"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </fieldset>

              <Veld
                label="Limiet per maand (€)"
                inputMode="decimal"
                placeholder="400"
                value={limiet}
                onChange={(e) => setLimiet(e.target.value)}
                hint={limiet ? `${formatEuroRond(parseBedrag(limiet))} per maand` : undefined}
                required
              />

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Voor wie</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "shared", titel: "Gedeeld", uitleg: "Jullie zien het allebei" },
                      { id: "personal", titel: "Persoonlijk", uitleg: "Alleen jij ziet het" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={scope === o.id}
                      onClick={() => setScope(o.id)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        scope === o.id
                          ? "border-[#2a5bd7] bg-[#e3eafb]"
                          : "border-[#d9d9d3] bg-white hover:bg-[#f6f6f2]"
                      }`}
                    >
                      <span className="block text-sm font-medium">{o.titel}</span>
                      <span className="block text-xs text-[#5c5c58]">{o.uitleg}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Knop type="submit" disabled={bewaar.isPending}>
                {pot ? "Opslaan" : "Potje toevoegen"}
              </Knop>
              {pot && (
                <Knop type="button" variant="gevaar" onClick={verwijder} disabled={archiveer.isPending}>
                  {zekerVerwijderen ? "Zeker weten? Tik nogmaals" : "Potje verwijderen"}
                </Knop>
              )}
            </div>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
