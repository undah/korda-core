// src/features/budget/components/BudgetOnboarding.tsx — start a household or join one with a code
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Home, UserPlus } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useMaakHuishouden, useSluitAan } from "../hooks/useBudget";
import { Kaart, Knop, Veld, foutTekst } from "./ui";

export type Keuze = "nieuw" | "aansluiten";

/** Create-or-join form. Used on first visit and from the household switcher. */
export function HuishoudenFormulier({
  start = "nieuw",
  standaardNaam = "",
  onKlaar,
}: {
  start?: Keuze;
  /** Pre-fill "Jouw naam" with how this user is known in their other households. */
  standaardNaam?: string;
  onKlaar: (householdId: string) => void;
}) {
  const { user } = useAuth();
  const [keuze, setKeuze] = useState<Keuze>(start);
  const voornaam =
    standaardNaam || ((user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "");
  const [jouwNaam, setJouwNaam] = useState(voornaam);
  const [naam, setNaam] = useState("");
  const [code, setCode] = useState("");
  const maak = useMaakHuishouden();
  const sluitAan = useSluitAan();
  const bezig = maak.isPending || sluitAan.isPending;

  const verstuur = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (keuze === "nieuw") {
        const id = await maak.mutateAsync({ naam, jouwNaam });
        toast.success(`${naam.trim()} aangemaakt`);
        onKlaar(id);
      } else {
        const id = await sluitAan.mutateAsync({ code, jouwNaam });
        toast.success("Je bent aangesloten");
        onKlaar(id);
      }
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-kb-sunk p-1" role="tablist">
        {(
          [
            { id: "nieuw", label: "Nieuw", icon: Home },
            { id: "aansluiten", label: "Ik heb een code", icon: UserPlus },
          ] as const
        ).map((k) => (
          <button
            key={k.id}
            type="button"
            role="tab"
            aria-selected={keuze === k.id}
            onClick={() => setKeuze(k.id)}
            className={`flex min-h-[2.5rem] items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all ${
              keuze === k.id
                ? "bg-kb-surface text-kb-ink shadow-[0_1px_3px_rgba(23,24,28,0.12)]"
                : "text-kb-ink2 hover:text-kb-ink"
            }`}
          >
            <k.icon className="h-4 w-4" strokeWidth={1.75} />
            {k.label}
          </button>
        ))}
      </div>

      <form onSubmit={verstuur} className="mt-5 space-y-4">
        {keuze === "nieuw" ? (
          <Veld
            label="Naam van het huishouden"
            placeholder="Bijv. Thuis of Vakantiehuis"
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            maxLength={80}
            required
          />
        ) : (
          <Veld
            label="Uitnodigingscode"
            placeholder="ABC234"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={6}
            hint="Wie je uitnodigt, maakt de code aan bij het huishouden onder Meer."
            required
          />
        )}
        <Veld
          label="Jouw naam"
          placeholder="Zoals de anderen je zien"
          value={jouwNaam}
          onChange={(e) => setJouwNaam(e.target.value)}
          maxLength={40}
          required
        />
        <Knop type="submit" className="w-full" disabled={bezig}>
          {keuze === "nieuw" ? "Huishouden aanmaken" : "Aansluiten"}
        </Knop>
      </form>
    </>
  );
}

/** First visit: no household yet. */
export function BudgetOnboarding({ onKlaar }: { onKlaar: (id: string) => void }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <p className="text-sm font-semibold tracking-tight">
        Korda<span className="text-kb-accent">Budget</span>
      </p>
      <h1 className="mt-3 text-[1.9rem] font-semibold leading-tight tracking-tight">
        Eerst een huishouden
      </h1>
      <p className="mt-2 text-sm text-kb-ink2">
        Begin er een, of sluit aan bij dat van je partner met de code die je kreeg. Later kun je er
        meer aanmaken, bijvoorbeeld een apart budget voor een vakantie.
      </p>
      <Kaart className="mt-6 p-5">
        <HuishoudenFormulier onKlaar={onKlaar} />
      </Kaart>
    </div>
  );
}
