// src/features/budget/components/BudgetOnboarding.tsx — first visit: start a household or join one
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Home, UserPlus } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useMaakHuishouden, useSluitAan } from "../hooks/useBudget";
import { Kaart, Knop, Veld, foutTekst } from "./ui";

type Keuze = "nieuw" | "aansluiten";

export function BudgetOnboarding() {
  const { user } = useAuth();
  const [keuze, setKeuze] = useState<Keuze>("nieuw");
  const voornaam = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "";
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
        await maak.mutateAsync({ naam, jouwNaam });
        toast.success("Huishouden aangemaakt");
      } else {
        await sluitAan.mutateAsync({ code, jouwNaam });
        toast.success("Je bent aangesloten");
      }
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <p className="text-sm font-semibold tracking-tight text-[#1d46b0]">KordaBudget</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Eerst je huishouden</h1>
      <p className="mt-2 text-sm text-[#5c5c58]">
        Begin een nieuw huishouden, of sluit aan bij dat van je partner met de code die je kreeg.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2" role="tablist">
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
            className={`flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors ${
              keuze === k.id
                ? "border-[#2a5bd7] bg-[#e3eafb] text-[#1d46b0]"
                : "border-[#d9d9d3] bg-[#fcfcfb] text-[#5c5c58]"
            }`}
          >
            <k.icon className="h-4 w-4" strokeWidth={1.75} />
            {k.label}
          </button>
        ))}
      </div>

      <Kaart className="mt-4 p-5">
        <form onSubmit={verstuur} className="space-y-4">
          {keuze === "nieuw" ? (
            <Veld
              label="Naam van het huishouden"
              placeholder="Bijv. Thuis"
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
              hint="Je partner maakt de code aan onder Meer → Huishouden."
              required
            />
          )}
          <Veld
            label="Jouw naam"
            placeholder="Zoals je partner je ziet"
            value={jouwNaam}
            onChange={(e) => setJouwNaam(e.target.value)}
            maxLength={40}
            required
          />
          <Knop type="submit" className="w-full" disabled={bezig}>
            {keuze === "nieuw" ? "Huishouden aanmaken" : "Aansluiten"}
          </Knop>
        </form>
      </Kaart>
    </div>
  );
}
