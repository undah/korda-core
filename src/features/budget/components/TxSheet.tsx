// src/features/budget/components/TxSheet.tsx — one transaction: pot, split, note, remember
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Split, Trash2, X } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import {
  useOnthoudRegel,
  useSplits,
  useVerwijderHandmatig,
  useZetNotitie,
  useZetPotje,
  useZetSoort,
} from "../hooks/useBudgetData";
import { formatEuro, parseBedrag } from "../lib/budget";
import type { BudgetPot, TxMetDelen, TxSoort } from "../types";
import { useBedragen } from "./Bedrag";
import { Blad, PotKiezer, Wissel } from "./Blad";
import { IcoonKnop, Knop, foutTekst } from "./ui";

type Deel = { key: string; potId: string | null; bedrag: string };
type Keuze = "potje" | TxSoort;
const sleutel = () => Math.random().toString(36).slice(2, 8);
const lang = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

export function TxSheet({
  tx,
  potjes,
  voorstel,
  householdId,
  onSluit,
}: {
  tx: TxMetDelen | null;
  potjes: BudgetPot[];
  /** Pot suggested by a learned rule. */
  voorstel: string | null;
  householdId: string;
  onSluit: () => void;
}) {
  const { user } = useAuth();
  const { euro } = useBedragen();
  const [potId, setPotId] = useState<string | null>(null);
  const [splitsen, setSplitsen] = useState(false);
  const [delen, setDelen] = useState<Deel[]>([]);
  const [notitie, setNotitie] = useState("");
  const [onthoud, setOnthoud] = useState(true);
  const [zeker, setZeker] = useState(false);
  const [keuze, setKeuze] = useState<Keuze>("potje");
  const zetSoort = useZetSoort();
  const zetPotje = useZetPotje();
  const zetSplits = useSplits();
  const zetNotitie = useZetNotitie();
  const regel = useOnthoudRegel();
  const verwijder = useVerwijderHandmatig();

  useEffect(() => {
    if (!tx) return;
    setPotId(tx.pot_id ?? voorstel);
    const gesplitst = tx.splits.length > 0;
    setSplitsen(gesplitst);
    setDelen(
      gesplitst
        ? tx.splits.map((s) => ({ key: sleutel(), potId: s.pot_id, bedrag: String(Math.abs(s.amount)).replace(".", ",") }))
        : [
            { key: sleutel(), potId: tx.pot_id ?? voorstel, bedrag: "" },
            { key: sleutel(), potId: null, bedrag: "" },
          ],
    );
    setNotitie(tx.note ?? "");
    setOnthoud(true);
    setZeker(false);
    // Money in with no pot is most likely income; suggest it, the user still saves.
    setKeuze(tx.soort ?? (tx.amount > 0 && !tx.pot_id && !gesplitst ? "inkomen" : "potje"));
  }, [tx, voorstel]);

  const totaal = tx ? Math.abs(tx.amount) : 0;
  const verdeeld = delen.reduce((s, d) => s + parseBedrag(d.bedrag), 0);
  const rest = Math.round((totaal - verdeeld) * 100) / 100;
  const isHandmatig = tx?.account?.provider === "handmatig" && tx.account.owner_id === user?.id;
  const kanSplitsen = useMemo(
    () => delen.length >= 2 && Math.abs(rest) < 0.005 && delen.every((d) => d.potId && parseBedrag(d.bedrag) > 0),
    [delen, rest],
  );

  const bewaar = async () => {
    if (!tx) return;
    try {
      let eerdere = 0;
      if (keuze !== "potje") {
        await zetSoort.mutateAsync({ txId: tx.id, soort: keuze });
        if (onthoud && tx.counterparty) {
          eerdere = await regel.mutateAsync({ householdId, tegenpartij: tx.counterparty, soort: keuze });
        }
      } else if (splitsen) {
        const teken = tx.amount < 0 ? -1 : 1;
        await zetSplits.mutateAsync({
          txId: tx.id,
          householdId,
          delen: delen.map((d) => ({ potId: d.potId!, amount: teken * parseBedrag(d.bedrag) })),
          wisSoort: !!tx.soort,
        });
      } else {
        await zetPotje.mutateAsync({ txId: tx.id, potId, wisSoort: !!tx.soort });
        if (onthoud && potId && tx.counterparty) {
          eerdere = await regel.mutateAsync({ householdId, tegenpartij: tx.counterparty, potId });
        }
      }
      if ((tx.note ?? "") !== notitie) await zetNotitie.mutateAsync({ txId: tx.id, note: notitie });
      const ook = eerdere ? `, plus ${eerdere} eerdere` : "";
      toast.success(
        keuze === "inkomen"
          ? `Gemarkeerd als inkomen${ook}`
          : keuze === "overboeking"
            ? `Gemarkeerd als overboeking${ook}`
            : splitsen
              ? "Gesplitst"
              : potId
                ? eerdere
                  ? `Ingedeeld, plus ${eerdere} eerdere van ${tx.counterparty}`
                  : "Ingedeeld"
                : "Opgeslagen",
      );
      onSluit();
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  return (
    <Blad
      open={!!tx}
      onOpenChange={(o) => !o && onSluit()}
      titel={tx?.counterparty ?? tx?.description ?? "Transactie"}
      beschrijving={tx ? <span className="first-letter:uppercase">{lang(tx.booked_on)}</span> : undefined}
    >
      {tx && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-kb-sunk px-4 py-3">
            <p className={`text-3xl font-semibold tracking-tight ${tx.amount > 0 ? "text-kb-good-ink" : ""}`}>
              {tx.amount > 0 ? "+" : "−"}
              {euro(totaal)}
            </p>
            {tx.description && tx.description !== tx.counterparty && (
              <p className="mt-1 text-xs text-kb-ink2">{tx.description}</p>
            )}
            {tx.account && <p className="mt-1 text-xs text-kb-ink2">Van {tx.account.name}</p>}
          </div>

          {tx.splits.length > 0 && !tx.account ? (
            <p className="rounded-xl bg-kb-sunk px-4 py-3 text-sm text-kb-ink2">
              Deze betaling is verdeeld door wie hem deed. Je ziet alleen het deel dat in een gedeeld
              potje valt; aanpassen kan alleen de ander.
            </p>
          ) : (
            <Wissel<Keuze>
              opties={[
                { id: "potje", titel: tx.amount < 0 ? "Uitgave" : "In potje", uitleg: tx.amount < 0 ? "In een potje" : "Terugbetaling" },
                ...(tx.amount > 0 ? [{ id: "inkomen" as const, titel: "Inkomen", uitleg: "Salaris e.d." }] : []),
                { id: "overboeking", titel: "Overboeking", uitleg: "Eigen rekening" },
              ]}
              waarde={keuze}
              onChange={setKeuze}
            />
          )}

          {tx.splits.length > 0 && !tx.account ? null : keuze !== "potje" ? (
            <div>
              <p className="text-sm text-kb-ink2">
                {keuze === "inkomen"
                  ? "Telt niet als uitgave en hoort in geen potje."
                  : "Geld tussen je eigen rekeningen: telt niet als uitgave of inkomen."}
              </p>
              {tx.counterparty && (
                <label className="mt-3 flex items-center gap-2.5 text-sm text-kb-ink2">
                  <input
                    type="checkbox"
                    checked={onthoud}
                    onChange={(e) => setOnthoud(e.target.checked)}
                    className="h-4 w-4 accent-kb-accent"
                  />
                  Voortaan {tx.counterparty} altijd als {keuze === "inkomen" ? "inkomen" : "overboeking"}
                </label>
              )}
            </div>
          ) : !splitsen ? (
            <div>
              <p className="mb-2 text-sm font-medium">In welk potje?</p>
              <PotKiezer potjes={potjes} waarde={potId} onKies={setPotId} metGeen />
              {potId && tx.counterparty && (
                <label className="mt-3 flex items-center gap-2.5 text-sm text-kb-ink2">
                  <input
                    type="checkbox"
                    checked={onthoud}
                    onChange={(e) => setOnthoud(e.target.checked)}
                    className="h-4 w-4 accent-kb-accent"
                  />
                  Voortaan {tx.counterparty} altijd hier
                </label>
              )}
              {/* Splitting needs the whole payment in view; a partner's private account isn't. */}
              {tx.amount < 0 && tx.account && (
                <button
                  type="button"
                  onClick={() => setSplitsen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-kb-accent-ink hover:underline"
                >
                  <Split className="h-4 w-4" /> Over meerdere potjes verdelen
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-sm font-medium">Verdelen</p>
                <p className={`text-xs ${Math.abs(rest) < 0.005 ? "text-kb-good-ink" : "text-kb-ink2"}`}>
                  {Math.abs(rest) < 0.005 ? "Klopt precies" : rest > 0 ? `Nog ${formatEuro(rest)} te verdelen` : `${formatEuro(-rest)} te veel`}
                </p>
              </div>
              <ul className="space-y-3">
                {delen.map((d, i) => (
                  <li key={d.key} className="rounded-xl border border-kb-line p-3">
                    <div className="flex items-center gap-2">
                      <input
                        inputMode="decimal"
                        placeholder={i === delen.length - 1 && rest > 0 ? formatEuro(rest) : "0,00"}
                        aria-label={`Bedrag deel ${i + 1}`}
                        value={d.bedrag}
                        onChange={(e) =>
                          setDelen((ds) => ds.map((x) => (x.key === d.key ? { ...x, bedrag: e.target.value } : x)))
                        }
                        onFocus={() => {
                          // Tapping an empty last part fills it with what's left.
                          if (!d.bedrag && rest > 0)
                            setDelen((ds) =>
                              ds.map((x) => (x.key === d.key ? { ...x, bedrag: String(rest).replace(".", ",") } : x)),
                            );
                        }}
                        className="h-11 flex-1 rounded-lg border border-kb-line-strong bg-white px-3 text-base outline-none focus:border-kb-accent"
                      />
                      {delen.length > 2 && (
                        <IcoonKnop aria-label={`Deel ${i + 1} weghalen`} onClick={() => setDelen((ds) => ds.filter((x) => x.key !== d.key))}>
                          <X className="h-4 w-4" />
                        </IcoonKnop>
                      )}
                    </div>
                    <div className="mt-2.5">
                      <PotKiezer
                        potjes={potjes}
                        waarde={d.potId}
                        onKies={(id) => setDelen((ds) => ds.map((x) => (x.key === d.key ? { ...x, potId: id } : x)))}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() => setDelen((ds) => [...ds, { key: sleutel(), potId: null, bedrag: "" }])}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-kb-accent-ink hover:underline"
                >
                  <Plus className="h-4 w-4" /> Deel toevoegen
                </button>
                <button
                  type="button"
                  onClick={() => setSplitsen(false)}
                  className="text-sm text-kb-ink2 hover:text-kb-ink"
                >
                  Toch niet splitsen
                </button>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="tx-notitie" className="mb-1.5 block text-sm font-medium">
              Notitie
            </label>
            <input
              id="tx-notitie"
              value={notitie}
              onChange={(e) => setNotitie(e.target.value)}
              placeholder="Bijv. verjaardag Sanne"
              className="h-11 w-full rounded-xl border border-kb-line-strong bg-white px-3 text-base outline-none focus:border-kb-accent"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Knop
              onClick={bewaar}
              disabled={(keuze === "potje" && splitsen && !kanSplitsen) || zetPotje.isPending || zetSplits.isPending || zetSoort.isPending}
            >
              {keuze === "potje" && splitsen ? "Verdeling opslaan" : "Opslaan"}
            </Knop>
            {isHandmatig && (
              <Knop
                variant="gevaar"
                disabled={verwijder.isPending}
                onClick={async () => {
                  if (!zeker) return setZeker(true);
                  try {
                    await verwijder.mutateAsync(tx.id);
                    toast.success("Uitgave verwijderd");
                    onSluit();
                  } catch (err) {
                    toast.error(foutTekst(err));
                  }
                }}
              >
                <Trash2 className="h-4 w-4" /> {zeker ? "Zeker weten? Tik nogmaals" : "Verwijderen"}
              </Knop>
            )}
          </div>
        </div>
      )}
    </Blad>
  );
}
