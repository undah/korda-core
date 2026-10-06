// src/features/budget/components/UitgaveSheet.tsx — add cash, a Tikkie or anything the bank doesn't see
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useHandmatigeUitgave } from "../hooks/useBudgetData";
import { parseBedrag } from "../lib/budget";
import type { BudgetPot } from "../types";
import { Blad, PotKiezer, Wissel } from "./Blad";
import { Knop, Veld, foutTekst } from "./ui";

const vandaag = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function UitgaveSheet({
  open,
  onOpenChange,
  householdId,
  potjes,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  potjes: BudgetPot[];
}) {
  const [soort, setSoort] = useState<"uit" | "in">("uit");
  const [bedrag, setBedrag] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [datum, setDatum] = useState(vandaag);
  const [potId, setPotId] = useState<string | null>(null);
  const [notitie, setNotitie] = useState("");
  const voegToe = useHandmatigeUitgave();

  useEffect(() => {
    if (!open) return;
    setSoort("uit");
    setBedrag("");
    setOmschrijving("");
    setDatum(vandaag());
    setPotId(null);
    setNotitie("");
  }, [open]);

  const verstuur = async (e: FormEvent) => {
    e.preventDefault();
    const b = parseBedrag(bedrag);
    if (b <= 0) return toast.error("Vul een bedrag in");
    try {
      await voegToe.mutateAsync({
        householdId,
        datum,
        bedrag: soort === "uit" ? -b : b,
        omschrijving,
        potId,
        notitie,
      });
      toast.success(soort === "uit" ? "Uitgave toegevoegd" : "Inkomst toegevoegd");
      onOpenChange(false);
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  return (
    <Blad
      open={open}
      onOpenChange={onOpenChange}
      titel="Zelf toevoegen"
      beschrijving="Voor contant geld, een Tikkie of iets wat de bank niet ziet. Alleen jij ziet hem, tenzij hij in een gedeeld potje valt."
    >
      <form onSubmit={verstuur} className="space-y-4">
        <Wissel<"uit" | "in">
          opties={[
            { id: "uit", titel: "Uitgave" },
            { id: "in", titel: "Inkomst", uitleg: "Bijv. terugbetaald" },
          ]}
          waarde={soort}
          onChange={setSoort}
        />
        <Veld
          label="Bedrag (€)"
          inputMode="decimal"
          placeholder="12,50"
          value={bedrag}
          onChange={(e) => setBedrag(e.target.value)}
          autoFocus
          required
        />
        <Veld
          label="Waar of wat"
          placeholder="Bijv. markt, kapper"
          value={omschrijving}
          onChange={(e) => setOmschrijving(e.target.value)}
          maxLength={80}
          required
        />
        <Veld label="Datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required />
        <div>
          <p className="mb-2 text-sm font-medium">Potje</p>
          <PotKiezer potjes={potjes} waarde={potId} onKies={setPotId} metGeen />
        </div>
        <Veld label="Notitie (optioneel)" value={notitie} onChange={(e) => setNotitie(e.target.value)} />
        <Knop type="submit" className="w-full" disabled={voegToe.isPending}>
          Toevoegen
        </Knop>
      </form>
    </Blad>
  );
}
