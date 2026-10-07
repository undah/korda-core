// src/features/budget/components/PotSheet.tsx — add or edit a pot in a bottom sheet
import { useEffect, useState, type FormEvent } from "react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { Lightbulb } from "lucide-react";
import { useArchiveerPotje, useBewaarPotje, useUitgavenHistorie, type PotInvoer } from "../hooks/useBudget";
import { formatEuroRond, huidigeMaand, parseBedrag } from "../lib/budget";
import { GROEPEN, limietVoorstel } from "../lib/inzicht";
import { Wissel } from "./Blad";
import type { BudgetPot, BudgetScope, PotGroep } from "../types";
import { Knop, Veld, foutTekst } from "./ui";

const EMOJI = ["🛒", "🏠", "🍝", "🚗", "📺", "👕", "🪴", "🎁", "💡", "🐶", "👶", "💊", "🎉", "✈️", "📚", "💶"];

export function PotSheet({
  open,
  onOpenChange,
  householdId,
  pot,
  volgendeSortering,
  onVerwijderd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  /** Omit to create a new pot. */
  pot?: BudgetPot;
  volgendeSortering: number;
  /** Called after the pot is deleted, e.g. to leave its detail page. */
  onVerwijderd?: () => void;
}) {
  const [naam, setNaam] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [limiet, setLimiet] = useState("");
  const [scope, setScope] = useState<BudgetScope>("shared");
  const [kind, setKind] = useState<"flexibel" | "vast">("flexibel");
  const [groep, setGroep] = useState<PotGroep | null>(null);
  const { data: historie = [] } = useUitgavenHistorie(open && pot ? householdId : undefined, huidigeMaand(), 4);
  const voorstel = pot
    ? limietVoorstel(
        historie.map((h) => ({ maand: h.maand, bedrag: h.perPot[pot.id] ?? 0 })),
        parseBedrag(limiet),
      )
    : null;
  const [zekerVerwijderen, setZekerVerwijderen] = useState(false);
  const bewaar = useBewaarPotje(householdId);
  const archiveer = useArchiveerPotje(householdId);

  useEffect(() => {
    if (!open) return;
    setNaam(pot?.name ?? "");
    setEmoji(pot?.emoji ?? EMOJI[0]);
    setLimiet(pot ? String(pot.monthly_limit).replace(".", ",") : "");
    setScope(pot?.scope ?? "shared");
    setKind(pot?.kind ?? "flexibel");
    setGroep(pot?.groep ?? null);
    setZekerVerwijderen(false);
  }, [open, pot]);

  const verstuur = async (e: FormEvent) => {
    e.preventDefault();
    const invoer: PotInvoer = {
      name: naam,
      emoji,
      monthly_limit: parseBedrag(limiet),
      scope,
      kind,
      // Only send the group once chosen, or when the column exists and it was cleared.
      ...(groep !== null || pot?.groep !== undefined ? { groep } : {}),
    };
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
      onVerwijderd?.();
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-kb-ink/40" />
        <Drawer.Content className="kb-root fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-kb-surface text-kb-ink outline-none">
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-kb-line-strong" />
          <form
            onSubmit={verstuur}
            className="overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4"
          >
            <Drawer.Title className="text-lg font-semibold tracking-tight">
              {pot ? "Potje bewerken" : "Nieuw potje"}
            </Drawer.Title>
            <Drawer.Description className="mt-1 text-sm text-kb-ink2">
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
                        emoji === e ? "bg-kb-accent-soft ring-2 ring-kb-accent" : "bg-kb-bg hover:bg-kb-sunk"
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
              {voorstel && (
                <button
                  type="button"
                  onClick={() => setLimiet(String(voorstel.bedrag))}
                  className="-mt-1 flex w-full items-start gap-2.5 rounded-xl bg-kb-accent-soft px-3 py-2.5 text-left text-sm text-kb-accent-ink hover:bg-kb-accent-soft/70"
                >
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    De afgelopen {voorstel.maanden} maanden gaf je gemiddeld zo'n{" "}
                    <strong>{formatEuroRond(voorstel.bedrag)}</strong> uit. Tik om dat als limiet te nemen.
                  </span>
                </button>
              )}

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Soort</legend>
                <Wissel<"flexibel" | "vast">
                  opties={[
                    { id: "flexibel", titel: "Flexibel", uitleg: "Boodschappen, uit eten" },
                    { id: "vast", titel: "Vast bedrag", uitleg: "Huur, abonnementen" },
                  ]}
                  waarde={kind}
                  onChange={setKind}
                />
              </fieldset>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Waar valt het onder?</legend>
                <Wissel<PotGroep>
                  opties={GROEPEN.map((g) => ({ id: g.id, titel: g.titel, uitleg: g.uitleg.split(",")[0] }))}
                  waarde={groep as PotGroep}
                  onChange={setGroep}
                />
              </fieldset>

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
                          ? "border-kb-accent bg-kb-accent-soft"
                          : "border-kb-line-strong bg-white hover:bg-kb-sunk/60"
                      }`}
                    >
                      <span className="block text-sm font-medium">{o.titel}</span>
                      <span className="block text-xs text-kb-ink2">{o.uitleg}</span>
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
