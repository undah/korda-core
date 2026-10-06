// src/pages/budget/BudgetTransacties.tsx — the month's money in and out, with the "nog indelen" inbox
import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeftRight, Check, Inbox, Plus, Split } from "lucide-react";
import { useBedragen } from "@/features/budget/components/Bedrag";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { TxSheet } from "@/features/budget/components/TxSheet";
import { UitgaveSheet } from "@/features/budget/components/UitgaveSheet";
import { Kaart, MaandKiezer, Pagina, foutTekst } from "@/features/budget/components/ui";
import { usePotjes } from "@/features/budget/hooks/useBudget";
import { useOnthoudRegel, useRegels, useTransacties, useZetPotje } from "@/features/budget/hooks/useBudgetData";
import { huidigeMaand } from "@/features/budget/lib/budget";
import { regelVoor } from "@/features/budget/lib/inzicht";
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

  const zichtbaar = useMemo(() => new Set(potjes.map((p) => p.id)), [potjes]);
  const potVan = (id: string | null) => potjes.find((p) => p.id === id);
  const teIndelen = transacties.filter((t) => !t.pot_id && t.splits.length === 0);
  const lijst = tab === "indelen" ? teIndelen : transacties;
  const inUit = useMemo(
    () => ({
      uit: transacties.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0),
      in: transacties.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
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
      if (t.counterparty) await onthoud.mutateAsync({ householdId: hhId, tegenpartij: t.counterparty, potId });
      toast.success(`${potVan(potId)?.name ?? "Potje"} ✓`);
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
                    const voorstel = !t.pot_id && !t.splits.length ? regelVoor(t, regels, zichtbaar) : null;
                    const pot = potVan(t.pot_id);
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <button type="button" onClick={() => setOpen(t)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-medium">
                            {t.counterparty ?? t.description ?? "Onbekend"}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-kb-ink2">
                            {t.splits.length ? (
                              <>
                                <Split className="h-3 w-3" /> Verdeeld over {t.splits.length} potjes
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
                            aria-label={`In ${potVan(voorstel)?.name} zetten`}
                          >
                            {potVan(voorstel)?.emoji} <Check className="h-3.5 w-3.5" />
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
        voorstel={open ? regelVoor(open, regels, zichtbaar) : null}
        householdId={hhId}
        onSluit={() => setOpen(null)}
      />
      <UitgaveSheet open={toevoegen} onOpenChange={setToevoegen} householdId={hhId} potjes={potjes} />
    </Pagina>
  );
}
