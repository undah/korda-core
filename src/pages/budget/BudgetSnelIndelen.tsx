// src/pages/budget/BudgetSnelIndelen.tsx — sort the inbox one card at a time.
//
// Swipe right to take the suggestion, left to skip for now, or tap a pot. A
// choice is remembered for that counterparty (and sorts its earlier payments),
// so the pile shrinks faster than one card per tap.
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeftRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Undo2, Wallet } from "lucide-react";
import { useBedragen } from "@/features/budget/components/Bedrag";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { Kaart, Knop, Pagina, foutTekst } from "@/features/budget/components/ui";
import { usePotjes } from "@/features/budget/hooks/useBudget";
import { useOnthoudRegel, useRegels, useTransacties, useZetPotje, useZetSoort } from "@/features/budget/hooks/useBudgetData";
import { huidigeMaand } from "@/features/budget/lib/budget";
import { regelVoor } from "@/features/budget/lib/inzicht";
import type { TxMetDelen, TxSoort } from "@/features/budget/types";

const DREMPEL = 96; // px of drag before a swipe counts

const lang = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00`));

type Actie = { tx: TxMetDelen; label: string };

export default function BudgetSnelIndelen() {
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const hhId = huishouden.household.id;
  const { euro } = useBedragen();
  const { data: transacties = [], isLoading } = useTransacties(hhId, huidigeMaand(), 3);
  const { data: potjes = [] } = usePotjes(hhId);
  const { data: regels = [] } = useRegels(hhId);
  const zetPotje = useZetPotje();
  const zetSoort = useZetSoort();
  const onthoud = useOnthoudRegel();

  // Handled or skipped in this session: hidden at once, before the refetch lands.
  const [klaar, setKlaar] = useState<Set<string>>(new Set());
  const [overgeslagen, setOvergeslagen] = useState<string[]>([]);
  const [vorige, setVorige] = useState<Actie | null>(null);
  const [onthouden, setOnthouden] = useState(true);
  const [dx, setDx] = useState(0);
  const [weg, setWeg] = useState<"links" | "rechts" | null>(null);
  const [slepen, setSlepen] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const zichtbaar = useMemo(() => new Set(potjes.map((p) => p.id)), [potjes]);
  const stapel = useMemo(() => {
    const open = transacties.filter((t) => !t.pot_id && !t.splits.length && !t.soort && !klaar.has(t.id));
    // Skipped ones go to the back, in the order they were skipped.
    const rang = new Map(overgeslagen.map((id, i) => [id, i]));
    return open.sort((a, b) => (rang.get(a.id) ?? -1) - (rang.get(b.id) ?? -1));
  }, [transacties, klaar, overgeslagen]);
  const totaal = stapel.length + klaar.size;
  const tx = stapel[0] ?? null;
  const voorstel = tx ? regelVoor(tx, regels, zichtbaar) : null;
  const voorstelPot = potjes.find((p) => p.id === voorstel);
  const bezig = zetPotje.isPending || zetSoort.isPending || onthoud.isPending;

  const afronden = (t: TxMetDelen, label: string) => {
    setKlaar((k) => new Set(k).add(t.id));
    setVorige({ tx: t, label });
    setDx(0);
    setWeg(null);
  };

  const kies = async (potId: string) => {
    if (!tx || bezig) return;
    const t = tx;
    const pot = potjes.find((p) => p.id === potId);
    try {
      await zetPotje.mutateAsync({ txId: t.id, potId });
      let eerdere = 0;
      if (onthouden && t.counterparty) eerdere = await onthoud.mutateAsync({ householdId: hhId, tegenpartij: t.counterparty, potId });
      afronden(t, `${pot?.emoji ?? ""} ${pot?.name ?? "Potje"}`);
      if (eerdere) toast.success(`Plus ${eerdere} eerdere van ${t.counterparty}`);
    } catch (e) {
      setDx(0);
      setWeg(null);
      toast.error(foutTekst(e));
    }
  };

  const markeer = async (soort: TxSoort) => {
    if (!tx || bezig) return;
    const t = tx;
    try {
      await zetSoort.mutateAsync({ txId: t.id, soort });
      afronden(t, soort === "inkomen" ? "Inkomen" : "Overboeking");
    } catch (e) {
      toast.error(foutTekst(e));
    }
  };

  const sla = () => {
    if (!tx) return;
    setOvergeslagen((o) => [...o.filter((id) => id !== tx.id), tx.id]);
    setDx(0);
    setWeg(null);
  };

  const herstel = async () => {
    if (!vorige) return;
    try {
      // Back to unsorted. The rule (if one was saved) stays; undo is for this one payment.
      await zetPotje.mutateAsync({ txId: vorige.tx.id, potId: null, wisSoort: true });
      setKlaar((k) => {
        const n = new Set(k);
        n.delete(vorige.tx.id);
        return n;
      });
      setOvergeslagen((o) => o.filter((id) => id !== vorige.tx.id));
      setVorige(null);
    } catch (e) {
      toast.error(foutTekst(e));
    }
  };

  // ─── swipe ───
  const omlaag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    start.current = { x: e.clientX, y: e.clientY };
    setSlepen(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const beweeg = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    // A mostly vertical drag is a scroll, not a swipe.
    if (Math.abs(e.clientY - start.current.y) > Math.abs(x) * 1.5 && Math.abs(x) < 12) return;
    setDx(x);
  };
  const los = () => {
    if (!start.current) return;
    start.current = null;
    setSlepen(false);
    if (dx > DREMPEL && voorstel) {
      setWeg("rechts");
      void kies(voorstel);
    } else if (dx < -DREMPEL) {
      setWeg("links");
      window.setTimeout(sla, 160);
    } else setDx(0);
  };

  const verschuiving = weg === "rechts" ? 480 : weg === "links" ? -480 : dx;
  const rechtsZonderVoorstel = dx > 24 && !voorstel;

  return (
    <Pagina
      titel="Snel indelen"
      sub={totaal > 0 && tx ? `${klaar.size + 1} van ${totaal}` : undefined}
      terug={{ naar: "/budget/transacties", label: "Transacties" }}
    >
      <div className="mx-auto max-w-md">
        {!isLoading && !tx ? (
          <Kaart className="px-6 py-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-kb-good-ink" />
            <p className="mt-4 text-lg font-semibold">Alles is ingedeeld</p>
            <p className="mt-1 text-sm text-kb-ink2">
              {klaar.size ? `${klaar.size} betalingen ingedeeld.` : "Er staat niets meer klaar."} Nieuwe betalingen komen hier
              vanzelf.
            </p>
            <Link
              to="/budget/overzicht"
              className="mt-6 inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-kb-accent px-5 text-sm font-medium text-white hover:bg-kb-accent-ink"
            >
              Naar overzicht
            </Link>
          </Kaart>
        ) : tx ? (
          <>
            {/* Progress */}
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-kb-accent-soft" aria-hidden>
              <div className="h-full rounded-full bg-kb-accent transition-all" style={{ width: `${(klaar.size / Math.max(totaal, 1)) * 100}%` }} />
            </div>

            <div
              key={tx.id}
              onPointerDown={omlaag}
              onPointerMove={beweeg}
              onPointerUp={los}
              onPointerCancel={los}
              className="relative touch-pan-y select-none"
              style={{
                transform: `translateX(${verschuiving}px) rotate(${verschuiving / 30}deg)`,
                transition: slepen ? "none" : "transform 180ms ease-out, opacity 180ms",
                opacity: weg ? 0 : 1,
              }}
            >
              <Kaart className="relative overflow-hidden p-6 shadow-[0_18px_40px_-24px_rgba(23,24,28,0.35)]">
                {/* What the swipe will do, shown as you drag. */}
                {dx > 24 && voorstelPot && (
                  <span className="absolute right-4 top-4 rounded-full bg-kb-accent px-3 py-1 text-xs font-semibold text-white">
                    {voorstelPot.emoji} {voorstelPot.name}
                  </span>
                )}
                {rechtsZonderVoorstel && (
                  <span className="absolute right-4 top-4 rounded-full bg-kb-sunk px-3 py-1 text-xs font-medium text-kb-ink2">
                    Kies hieronder een potje
                  </span>
                )}
                {dx < -24 && (
                  <span className="absolute left-4 top-4 rounded-full bg-kb-sunk px-3 py-1 text-xs font-medium text-kb-ink2">
                    Later
                  </span>
                )}

                <p className="text-xs text-kb-ink2 first-letter:uppercase">{lang(tx.booked_on)}</p>
                <p className={`mt-3 text-4xl font-semibold tracking-tight tabular-nums ${tx.amount > 0 ? "text-kb-good-ink" : ""}`}>
                  {tx.amount > 0 ? "+" : "−"}
                  {euro(Math.abs(tx.amount))}
                </p>
                <p className="mt-2 text-lg font-medium leading-snug">{tx.counterparty ?? tx.description ?? "Onbekend"}</p>
                {tx.description && tx.description !== tx.counterparty && (
                  <p className="mt-1 line-clamp-2 text-xs text-kb-ink2">{tx.description}</p>
                )}
                {tx.account && <p className="mt-1 text-xs text-kb-ink3">{tx.account.name}</p>}

                {voorstelPot && (
                  <button
                    type="button"
                    onClick={() => kies(voorstelPot.id)}
                    disabled={bezig}
                    className="mt-5 flex w-full items-center justify-between rounded-xl bg-kb-accent-soft px-4 py-3 text-sm font-medium text-kb-accent-ink hover:bg-kb-accent-soft/70"
                  >
                    <span>
                      {voorstelPot.emoji} {voorstelPot.name}
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                      Veeg rechts <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                )}
              </Kaart>
            </div>

            <p className="mt-5 mb-2 text-sm font-medium">{voorstelPot ? "Of kies een ander potje" : "In welk potje?"}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {potjes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={bezig}
                  onClick={() => kies(p.id)}
                  className="flex min-h-[2.75rem] items-center gap-2 rounded-xl border border-kb-line-strong bg-white px-3 text-left text-sm hover:bg-kb-sunk disabled:opacity-50"
                >
                  <span>{p.emoji}</span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
              {tx.amount > 0 && (
                <button
                  type="button"
                  disabled={bezig}
                  onClick={() => markeer("inkomen")}
                  className="flex min-h-[2.75rem] items-center gap-2 rounded-xl border border-kb-line-strong bg-white px-3 text-sm hover:bg-kb-sunk"
                >
                  <Wallet className="h-4 w-4 text-kb-good-ink" /> Inkomen
                </button>
              )}
              <button
                type="button"
                disabled={bezig}
                onClick={() => markeer("overboeking")}
                className="flex min-h-[2.75rem] items-center gap-2 rounded-xl border border-kb-line-strong bg-white px-3 text-sm hover:bg-kb-sunk"
              >
                <ArrowLeftRight className="h-4 w-4 text-kb-ink2" /> Overboeking
              </button>
            </div>

            <label className="mt-4 flex items-center gap-2.5 text-sm text-kb-ink2">
              <input type="checkbox" checked={onthouden} onChange={(e) => setOnthouden(e.target.checked)} className="h-4 w-4 accent-kb-accent" />
              Onthouden voor {tx.counterparty ?? "deze tegenpartij"}
            </label>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <Knop variant="rustig" onClick={sla} disabled={bezig}>
                <ChevronLeft className="h-4 w-4" /> Later
              </Knop>
              <Knop variant="rustig" onClick={herstel} disabled={!vorige || bezig}>
                <Undo2 className="h-4 w-4" /> Terug
              </Knop>
            </div>
            {vorige && (
              <p className="mt-2 text-center text-xs text-kb-ink2">
                <Check className="mr-1 inline h-3 w-3" />
                {vorige.tx.counterparty ?? "Vorige"} → {vorige.label}
              </p>
            )}
          </>
        ) : null}
      </div>
    </Pagina>
  );
}
