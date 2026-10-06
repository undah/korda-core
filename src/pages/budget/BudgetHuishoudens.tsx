// src/pages/budget/BudgetHuishoudens.tsx — all households: open, rename, delete (maker) or leave (member)
import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { Check, Crown, DoorOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { HuishoudenFormulier } from "@/features/budget/components/BudgetOnboarding";
import { Avatars, IcoonKnop, Kaart, Knop, Pagina, Veld, foutTekst } from "@/features/budget/components/ui";
import {
  useHernoemHuishouden,
  useVerlaatHuishouden,
  useVerwijderHuishouden,
  type Huishouden,
} from "@/features/budget/hooks/useBudget";

export default function BudgetHuishoudens() {
  const { huishouden: actief, huishoudens, kies } = useOutletContext<BudgetOutletContext>();
  const navigate = useNavigate();
  const [nieuw, setNieuw] = useState(false);

  return (
    <Pagina
      titel="Huishoudens"
      sub="Elk huishouden heeft zijn eigen potjes, rekeningen en leden."
      terug={{ naar: "/budget/meer", label: "Meer" }}
      actie={
        !nieuw && (
          <Knop onClick={() => setNieuw(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Toevoegen</span>
          </Knop>
        )
      }
    >
      <div className="max-w-2xl space-y-4">
        {nieuw && (
          <Kaart className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold">Huishouden toevoegen</p>
              <IcoonKnop aria-label="Sluiten" onClick={() => setNieuw(false)}>
                <X className="h-4 w-4" />
              </IcoonKnop>
            </div>
            <HuishoudenFormulier
              standaardNaam={actief.me.display_name}
              onKlaar={(id) => {
                setNieuw(false);
                kies(id);
                navigate("/budget/overzicht");
              }}
            />
          </Kaart>
        )}

        {huishoudens.map((h) => (
          <HuishoudenKaart
            key={h.household.id}
            h={h}
            isActief={h.household.id === actief.household.id}
            onOpen={() => {
              kies(h.household.id);
              navigate("/budget/overzicht");
            }}
          />
        ))}

        <p className="px-1 text-xs text-kb-ink2">
          Wie een huishouden aanmaakt, kan het verwijderen. Wie via een code aansloot, kan het
          verlaten; je persoonlijke potjes en rekeningen in dat huishouden gaan dan mee.
        </p>
      </div>
    </Pagina>
  );
}

type Modus = "rust" | "hernoemen" | "verwijderen" | "verlaten";

function HuishoudenKaart({ h, isActief, onOpen }: { h: Huishouden; isActief: boolean; onOpen: () => void }) {
  const [modus, setModus] = useState<Modus>("rust");
  const [naam, setNaam] = useState(h.household.name);
  const [bevestiging, setBevestiging] = useState("");
  const hernoem = useHernoemHuishouden();
  const verwijder = useVerwijderHuishouden();
  const verlaat = useVerlaatHuishouden();
  const andere = h.members.filter((m) => m.user_id !== h.me.user_id);

  const reset = () => {
    setModus("rust");
    setBevestiging("");
    setNaam(h.household.name);
  };

  return (
    <Kaart className={`p-5 ${isActief ? "ring-2 ring-kb-accent/60" : ""}`}>
      <div className="flex items-start gap-3">
        <Avatars leden={h.members} groot />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            <span className="truncate">{h.household.name}</span>
            {isActief && (
              <span className="shrink-0 rounded-full bg-kb-accent-soft px-2 py-0.5 text-[0.68rem] font-medium text-kb-accent-ink">
                Geopend
              </span>
            )}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-kb-ink2">
            {h.isMaker ? (
              <>
                <Crown className="h-3 w-3" /> Aangemaakt door jou
              </>
            ) : (
              "Aangesloten met een code"
            )}
            {" · "}
            {andere.length === 0 ? "alleen jij" : `met ${andere.map((m) => m.display_name).join(", ")}`}
          </p>
        </div>
      </div>

      {modus === "rust" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {!isActief && (
            <Knop variant="zacht" onClick={onOpen}>
              Openen
            </Knop>
          )}
          {h.isMaker && (
            <Knop variant="rustig" onClick={() => setModus("hernoemen")}>
              <Pencil className="h-4 w-4" /> Hernoemen
            </Knop>
          )}
          {h.isMaker ? (
            <Knop variant="gevaar" onClick={() => setModus("verwijderen")}>
              <Trash2 className="h-4 w-4" /> Verwijderen
            </Knop>
          ) : (
            <Knop variant="gevaar" onClick={() => setModus("verlaten")}>
              <DoorOpen className="h-4 w-4" /> Verlaten
            </Knop>
          )}
        </div>
      )}

      {modus === "hernoemen" && (
        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await hernoem.mutateAsync({ householdId: h.household.id, naam });
              toast.success("Naam bijgewerkt");
              setModus("rust");
            } catch (err) {
              toast.error(foutTekst(err));
            }
          }}
        >
          <Veld
            label="Nieuwe naam"
            id={`naam-${h.household.id}`}
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            maxLength={80}
            className="flex-1"
            autoFocus
            required
          />
          <IcoonKnop type="submit" aria-label="Opslaan" disabled={hernoem.isPending} className="mb-1 bg-kb-accent text-white hover:bg-kb-accent-ink hover:text-white">
            <Check className="h-4 w-4" />
          </IcoonKnop>
          <IcoonKnop aria-label="Annuleren" onClick={reset} className="mb-1">
            <X className="h-4 w-4" />
          </IcoonKnop>
        </form>
      )}

      {modus === "verwijderen" && (
        <div className="mt-4 rounded-xl bg-kb-crit-soft/60 p-4">
          <p className="text-sm font-medium text-kb-crit-ink">Alles in dit huishouden verdwijnt</p>
          <p className="mt-1 text-sm text-kb-ink2">
            Potjes, rekeningen en transacties van iedereen
            {andere.length > 0 && ` — ook die van ${andere.map((m) => m.display_name).join(", ")}`}.
            Dit kan niet ongedaan worden gemaakt.
          </p>
          <Veld
            label={`Typ "${h.household.name}" om te bevestigen`}
            id={`bevestig-${h.household.id}`}
            value={bevestiging}
            onChange={(e) => setBevestiging(e.target.value)}
            autoComplete="off"
            className="mt-3"
          />
          <div className="mt-3 flex gap-2">
            <Knop
              className="flex-1 bg-kb-crit text-white hover:bg-kb-crit-ink"
              disabled={bevestiging.trim() !== h.household.name.trim() || verwijder.isPending}
              onClick={async () => {
                try {
                  await verwijder.mutateAsync(h.household.id);
                  toast.success(`${h.household.name} verwijderd`);
                } catch (err) {
                  toast.error(foutTekst(err));
                }
              }}
            >
              Definitief verwijderen
            </Knop>
            <Knop variant="rustig" onClick={reset}>
              Annuleren
            </Knop>
          </div>
        </div>
      )}

      {modus === "verlaten" && (
        <div className="mt-4 rounded-xl bg-kb-sunk p-4">
          <p className="text-sm font-medium">{h.household.name} verlaten?</p>
          <p className="mt-1 text-sm text-kb-ink2">
            Je persoonlijke potjes en de rekeningen die jij hier koppelde, gaan mee weg. Gedeelde
            potjes blijven voor de anderen. Terugkomen kan met een nieuwe code.
          </p>
          <div className="mt-3 flex gap-2">
            <Knop
              variant="gevaar"
              className="flex-1"
              disabled={verlaat.isPending}
              onClick={async () => {
                try {
                  await verlaat.mutateAsync(h.household.id);
                  toast.success(`Je hebt ${h.household.name} verlaten`);
                } catch (err) {
                  toast.error(foutTekst(err));
                }
              }}
            >
              Verlaten
            </Knop>
            <Knop variant="rustig" onClick={reset}>
              Annuleren
            </Knop>
          </div>
        </div>
      )}
    </Kaart>
  );
}
