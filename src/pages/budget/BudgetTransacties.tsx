// src/pages/budget/BudgetTransacties.tsx — the month's money in and out, with the "nog indelen" inbox
import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeftRight, Check, ChevronLeft, ChevronRight, Inbox, Layers, Plus, Sparkles, Split, Wallet } from "lucide-react";
import { useBedragen } from "@/features/budget/components/Bedrag";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { TxSheet } from "@/features/budget/components/TxSheet";
import { UitgaveSheet } from "@/features/budget/components/UitgaveSheet";
import { Kaart, MaandKiezer, Pagina, foutTekst } from "@/features/budget/components/ui";
import { usePotjes } from "@/features/budget/hooks/useBudget";
import { useOnthoudRegel, useRegels, useTransacties, useZetPotje, useZetSoort } from "@/features/budget/hooks/useBudgetData";
import { huidigeMaand, maandNaam, verschuifMaand } from "@/features/budget/lib/budget";
import { voorstelVoor } from "@/features/budget/lib/inzicht";
import type { TxMetDelen } from "@/features/budget/types";

const dagKop = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

export default function BudgetTransacties() {
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const hhId = huishouden.household.id;
  const { euro } = useBedragen();
  const [maand, setMaand] = useState(huidigeMaand);
  const [tab, setTab] = useState<"indelen" | "alles">("indelen");
  const [open, setOpen] = useState<TxMetDelen | null>(null);
  const [toevoegen, setToevoegen] = useState(false);
  const { data: transacties = [], isLoading } = useTransacties(hhId, maand);
  const { data: potjes = [] } = usePotjes(hhId);
  const { data: regels = [] } = useRegels(hhId);
  const zetPotje = useZetPotje();
  const onthoud = useOnthoudRegel();
  const zetSoort = useZetSoort();

  const zichtbaar = useMemo(() => new Set(potjes.map((p) => p.id)), [potjes]);
  const potVan = (id: string | null) => potjes.find((p) => p.id === id);
  const teIndelen = transacties.filter((t) => !t.pot_id && t.splits.length === 0 && !t.soort);
  const lijst = tab === "indelen" ? teIndelen : transacties;
  const inUit = useMemo(
    () => ({
      // Moving money between your own accounts is neither.
      uit: transacties.filter((t) => t.amount < 0 && t.soort !== "overboeking").reduce((s, t) => s - t.amount, 0),
      in: transacties.filter((t) => t.amount > 0 && t.soort !== "overboeking").reduce((s, t) => s + t.amount, 0),
    }),
    [transacties],
  );

  const perDag = useMemo(() => {
    const groepen: Array<{ dag: string; items: TxMetDelen[] }> = [];
    for (const t of lijst) {
      const laatste = groepen[groepen.length - 1];
      if (laatste?.dag === t.booked_on) laatste.items.push(t);
      else groepen.push({ dag: t.booked_on, items: [t] });
    }
    return groepen;
  }, [lijst]);

  const bevestig = async (t: TxMetDelen, potId: string) => {
    try {
      await zetPotje.mutateAsync({ txId: t.id, potId });
      const eerdere = t.counterparty
        ? await onthoud.mutateAsync({ householdId: hhId, tegenpartij: t.counterparty, potId })
        : 0;
      toast.success(`${potVan(potId)?.name ?? "Potje"} ✓${eerdere ? `, plus ${eerdere} eerdere` : ""}`);
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  const alsSoort = async (t: TxMetDelen, soort: "overboeking") => {
    try {
      await zetSoort.mutateAsync({ txId: t.id, soort });
      toast.success("Overboeking ✓");
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  const alsInkomen = async (t: TxMetDelen) => {
    try {
      await zetSoort.mutateAsync({ txId: t.id, soort: "inkomen" });
      // Remembered: a weekly salary then marks itself from now on.
      const eerdere = t.counterparty
        ? await onthoud.mutateAsync({ householdId: hhId, tegenpartij: t.counterparty, soort: "inkomen" })
        : 0;
      toast.success(`Inkomen ✓${eerdere ? `, plus ${eerdere} eerdere` : ""} · voortaan automatisch`);
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  return (
    <Pagina titel="Transacties">
      {/* Bottom padding keeps the last amount clear of the floating + button. */}
      <div className="max-w-2xl space-y-5 pb-20 md:pb-0">
        <div className="-mt-3 flex justify-center sm:justify-start">
          <MaandKiezer maand={maand} onChange={setMaand} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Kaart className="px-4 py-3">
            <p className="text-xs text-kb-ink2">Uitgegeven</p>
            <p className="mt-0.5 text-lg font-semibold tracking-tight">{euro(inUit.uit)}</p>
          </Kaart>
          <Kaart className="px-4 py-3">
            <p className="text-xs text-kb-ink2">Binnengekomen</p>
            <p className="mt-0.5 text-lg font-semibold tracking-tight text-kb-good-ink">{euro(inUit.in)}</p>
          </Kaart>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-kb-sunk p-1" role="tablist">
          {(
            [
              { id: "indelen", label: `Nog indelen${teIndelen.length ? ` (${teIndelen.length})` : ""}` },
              { id: "alles", label: "Alles" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-[2.5rem] rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? "bg-kb-surface text-kb-ink shadow-[0_1px_3px_rgba(23,24,28,0.12)]" : "text-kb-ink2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "indelen" && teIndelen.length > 1 && (
          <Link
            to="/budget/indelen"
            className="flex items-center gap-3 rounded-2xl bg-kb-accent px-4 py-3.5 text-white shadow-[0_10px_30px_-14px_rgba(61,59,212,0.8)] hover:bg-kb-accent-ink"
          >
            <Layers className="h-5 w-5" />
            <span className="flex-1">
              <span className="block text-sm font-semibold">Snel indelen</span>
              <span className="block text-xs text-white/80">Eén voor één, veeg of tik een potje</span>
            </span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}

        {!isLoading && lijst.length === 0 ? (
          <Kaart className="px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-kb-accent-soft text-kb-accent-ink">
              {tab === "indelen" ? <Inbox className="h-5 w-5" /> : <ArrowLeftRight className="h-5 w-5" />}
            </div>
            <p className="mt-4 font-medium">
              {tab === "indelen" ? (transacties.length ? "Alles is ingedeeld" : "Nog niets deze maand") : "Nog niets deze maand"}
            </p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-kb-ink2">
              Na het koppelen van ING komen je uitgaven hier vanzelf binnen. Contant betaald? Voeg het
              toe met de plusknop.
            </p>
            <Link to="/budget/rekeningen" className="mt-4 inline-block text-sm font-medium text-kb-accent-ink underline">
              Rekeningen beheren
            </Link>
          </Kaart>
        ) : (
          <div className="space-y-5">
            {perDag.map((g) => (
              <section key={g.dag}>
                <h2 className="mb-2 px-1 text-xs font-medium text-kb-ink2 first-letter:uppercase">{dagKop(g.dag)}</h2>
                <Kaart className="divide-y divide-kb-line overflow-hidden">
                  {g.items.map((t) => {
                    const open_ = !t.pot_id && !t.splits.length && !t.soort;
                    const vs = open_ ? voorstelVoor(t, regels, zichtbaar) : null;
                    const voorstel = vs?.potId ?? null;
                    const vanClaude = vs?.bron === "claude";
                    const pot = potVan(t.pot_id);
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <button type="button" onClick={() => setOpen(t)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-medium">
                            {t.counterparty ?? t.description ?? "Onbekend"}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-kb-ink2">
                            {t.in_behandeling && (
                              <span className="rounded bg-kb-sunk px-1.5 py-px font-medium text-kb-ink2">In behandeling</span>
                            )}
                            {t.splits.length ? (
                              <>
                                <Split className="h-3 w-3" /> Verdeeld over {t.splits.length} potjes
                              </>
                            ) : t.soort === "inkomen" ? (
                              <>
                                <Wallet className="h-3 w-3" /> Inkomen
                              </>
                            ) : t.soort === "overboeking" ? (
                              <>
                                <ArrowLeftRight className="h-3 w-3" /> Overboeking
                              </>
                            ) : pot ? (
                              `${pot.emoji} ${pot.name}`
                            ) : (
                              <span className="text-kb-warn-ink">Nog indelen</span>
                            )}
                            {t.note && ` · ${t.note}`}
                          </span>
                        </button>
                        {voorstel ? (
                          <button
                            type="button"
                            onClick={() => bevestig(t, voorstel)}
                            className="flex shrink-0 items-center gap-1 rounded-full bg-kb-accent-soft px-2.5 py-1.5 text-xs font-medium text-kb-accent-ink hover:bg-kb-accent-soft/70"
                            aria-label={`In ${potVan(voorstel)?.name} zetten${vanClaude ? " (voorstel van Claude)" : ""}`}
                            title={vanClaude ? "Voorstel van Claude" : "Volgens je regel"}
                          >
                            {vanClaude && <Sparkles className="h-3 w-3" />}
                            {potVan(voorstel)?.emoji} <Check className="h-3.5 w-3.5" />
                          </button>
                        ) : vs?.soort === "overboeking" ? (
                          <button
                            type="button"
                            onClick={() => alsSoort(t, "overboeking")}
                            className="flex shrink-0 items-center gap-1 rounded-full bg-kb-accent-soft px-2.5 py-1.5 text-xs font-medium text-kb-accent-ink hover:bg-kb-accent-soft/70"
                            aria-label="Als overboeking markeren (voorstel van Claude)"
                          >
                            <Sparkles className="h-3 w-3" /> Overboeking <Check className="h-3.5 w-3.5" />
                          </button>
                        ) : open_ && t.amount > 0 ? (
                          <button
                            type="button"
                            onClick={() => alsInkomen(t)}
                            className="flex shrink-0 items-center gap-1 rounded-full bg-kb-accent-soft px-2.5 py-1.5 text-xs font-medium text-kb-accent-ink hover:bg-kb-accent-soft/70"
                            aria-label="Als inkomen markeren"
                          >
                            Inkomen <Check className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setOpen(t)}
                          className={`shrink-0 text-sm font-medium tabular-nums ${t.amount > 0 ? "text-kb-good-ink" : ""}`}
                        >
                          {t.amount > 0 ? "+" : "−"}
                          {euro(Math.abs(t.amount))}
                        </button>
                      </div>
                    );
                  })}
                </Kaart>
              </section>
            ))}
          </div>
        )}

        {/* The month switcher sits at the top; at the end of a long list, offer the step back here. */}
        <button
          type="button"
          onClick={() => {
            setMaand((m) => verschuifMaand(m, -1));
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-kb-line bg-kb-surface py-3 text-sm font-medium text-kb-accent-ink hover:bg-kb-sunk/60"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="first-letter:uppercase">{maandNaam(verschuifMaand(maand, -1))}</span> bekijken
        </button>
      </div>

      <button
        type="button"
        onClick={() => setToevoegen(true)}
        aria-label="Zelf een uitgave toevoegen"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-kb-accent text-white shadow-[0_10px_30px_-10px_rgba(61,59,212,0.8)] transition-transform hover:scale-105 md:bottom-8 md:right-8"
      >
        <Plus className="h-6 w-6" />
      </button>

      <TxSheet
        tx={open}
        potjes={potjes}
        voorstel={open ? (voorstelVoor(open, regels, zichtbaar)?.potId ?? null) : null}
        doorClaude={open ? voorstelVoor(open, regels, zichtbaar)?.bron === "claude" : false}
        householdId={hhId}
        onSluit={() => setOpen(null)}
      />
      <UitgaveSheet open={toevoegen} onOpenChange={setToevoegen} householdId={hhId} potjes={potjes} />
    </Pagina>
  );
}
