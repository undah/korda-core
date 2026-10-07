// src/pages/budget/BudgetWeek.tsx — the last 7 days: per day, per pot, and every payment
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CalendarClock, TrendingDown, TrendingUp } from "lucide-react";
import { useBedragen } from "@/features/budget/components/Bedrag";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { TxSheet } from "@/features/budget/components/TxSheet";
import { Kaart, Pagina, Sectie } from "@/features/budget/components/ui";
import { usePotjes } from "@/features/budget/hooks/useBudget";
import { useRegels, useTransacties } from "@/features/budget/hooks/useBudgetData";
import { huidigeMaand } from "@/features/budget/lib/budget";
import { regelVoor, weekDetail } from "@/features/budget/lib/inzicht";
import type { TxMetDelen } from "@/features/budget/types";

const opDag = (iso: string, opties: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("nl-NL", opties).format(new Date(`${iso}T12:00:00`));

export default function BudgetWeek() {
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const hhId = huishouden.household.id;
  const { euro } = useBedragen();
  // Two months, so the 14 days needed reach back across a month start.
  const { data: transacties = [], isLoading } = useTransacties(hhId, huidigeMaand(), 2);
  const { data: potjes = [] } = usePotjes(hhId);
  const { data: regels = [] } = useRegels(hhId);
  const [open, setOpen] = useState<TxMetDelen | null>(null);

  const w = useMemo(() => weekDetail(transacties, potjes), [transacties, potjes]);
  const vorigeTotaal = w.potten.reduce((s, p) => s + p.vorige, 0);
  const verschil = w.totaal - vorigeTotaal;
  const hoogste = Math.max(...w.dagen.map((d) => d.bedrag), 0);
  const zichtbaar = useMemo(() => new Set(potjes.map((p) => p.id)), [potjes]);
  const vast = useMemo(() => new Set(potjes.filter((p) => p.kind === "vast").map((p) => p.id)), [potjes]);

  const perDag = useMemo(() => {
    const groepen = new Map<string, TxMetDelen[]>();
    for (const t of w.transacties) groepen.set(t.booked_on, [...(groepen.get(t.booked_on) ?? []), t]);
    return [...groepen.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [w.transacties]);

  const van = w.dagen[0]?.datum;
  const tot = w.dagen[6]?.datum;

  return (
    <Pagina
      titel="Afgelopen 7 dagen"
      sub={van && tot ? `${opDag(van, { day: "numeric", month: "short" })} – ${opDag(tot, { day: "numeric", month: "short" })}` : undefined}
      terug={{ naar: "/budget/overzicht", label: "Overzicht" }}
    >
      <div className="max-w-2xl space-y-6">
        <Kaart className="p-5">
          <p className="text-sm text-kb-ink2">Dagelijkse uitgaven, zonder vaste lasten</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{euro(w.totaal)}</p>
          <p className="mt-1 text-sm text-kb-ink2">Gemiddeld {euro(w.gemiddeld)} per dag</p>
          {vorigeTotaal > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-kb-ink2">
              {verschil > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {euro(Math.abs(verschil))} {verschil > 0 ? "meer" : "minder"} dan de week ervoor
            </p>
          )}

          {/* Seven bars, one per day. Only the busiest day carries its amount; the rest are in the tooltip. */}
          <div className="mt-6 grid h-40 grid-cols-7 items-end gap-2" role="list" aria-label="Uitgaven per dag">
            {w.dagen.map((d, i) => {
              const hoog = hoogste > 0 ? Math.max((d.bedrag / hoogste) * 100, d.bedrag > 0 ? 3 : 0) : 0;
              const vandaag = i === 6;
              const label = `${opDag(d.datum, { weekday: "long", day: "numeric", month: "long" })}: ${euro(d.bedrag)}`;
              return (
                <div key={d.datum} role="listitem" aria-label={label} title={label} className="group flex h-full flex-col items-center justify-end">
                  {d.bedrag === hoogste && hoogste > 0 && (
                    <span className="mb-1 text-[0.68rem] font-medium tabular-nums text-kb-ink2">{euro(d.bedrag)}</span>
                  )}
                  <div className="flex w-full flex-1 items-end rounded-t-[4px] bg-kb-accent-soft/60">
                    <div
                      className="w-full rounded-t-[4px] bg-kb-accent transition-opacity group-hover:opacity-80"
                      style={{ height: `${hoog}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2 text-center text-xs">
            {w.dagen.map((d, i) => (
              <span key={d.datum} className={i === 6 ? "font-semibold text-kb-ink" : "text-kb-ink2"}>
                {i === 6 ? "vandaag" : opDag(d.datum, { weekday: "short" }).replace(".", "")}
              </span>
            ))}
          </div>
        </Kaart>

        {w.potten.length > 0 && (
          <Sectie titel="Per potje" aside={<span className="text-xs text-kb-ink2">vorige week</span>}>
            <Kaart className="divide-y divide-kb-line overflow-hidden">
              {w.potten.map((r) => {
                const aandeel = w.totaal > 0 ? (r.deze / w.totaal) * 100 : 0;
                return (
                  <div key={r.pot?.id ?? "geen"} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">
                        {r.pot ? `${r.pot.emoji} ${r.pot.name}` : "Nog niet ingedeeld"}
                      </span>
                      <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                        <span className="font-medium">{euro(r.deze)}</span>
                        <span className="w-16 text-right text-xs text-kb-ink2">{euro(r.vorige)}</span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-kb-accent-soft">
                      <div className="h-full rounded-full bg-kb-accent" style={{ width: `${aandeel}%` }} />
                    </div>
                  </div>
                );
              })}
            </Kaart>
          </Sectie>
        )}

        {w.vasteLasten > 0 && (
          <p className="flex items-center gap-2 px-1 text-sm text-kb-ink2">
            <CalendarClock className="h-4 w-4 shrink-0" /> Daarnaast {euro(w.vasteLasten)} aan vaste lasten deze week.
          </p>
        )}

        <Sectie titel="Alle betalingen">
          {!isLoading && perDag.length === 0 ? (
            <Kaart className="px-6 py-10 text-center text-sm text-kb-ink2">Geen uitgaven in de afgelopen 7 dagen.</Kaart>
          ) : (
            <div className="space-y-4">
              {perDag.map(([dag, items]) => (
                <section key={dag}>
                  <h3 className="mb-2 px-1 text-xs font-medium text-kb-ink2 first-letter:uppercase">
                    {opDag(dag, { weekday: "long", day: "numeric", month: "long" })}
                  </h3>
                  <Kaart className="divide-y divide-kb-line overflow-hidden">
                    {items.map((t) => {
                      const pot = potjes.find((p) => p.id === t.pot_id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setOpen(t)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-kb-sunk/60"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{t.counterparty ?? t.description ?? "Onbekend"}</span>
                            <span className="block truncate text-xs text-kb-ink2">
                              {t.soort === "overboeking"
                                ? "Overboeking"
                                : t.splits.length
                                  ? `Verdeeld over ${t.splits.length} potjes`
                                  : pot
                                    ? `${pot.emoji} ${pot.name}${vast.has(pot.id) ? " · vaste last" : ""}`
                                    : "Nog indelen"}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-medium tabular-nums">−{euro(Math.abs(t.amount))}</span>
                        </button>
                      );
                    })}
                  </Kaart>
                </section>
              ))}
            </div>
          )}
        </Sectie>
      </div>

      <TxSheet
        tx={open}
        potjes={potjes}
        voorstel={open ? regelVoor(open, regels, zichtbaar) : null}
        householdId={hhId}
        onSluit={() => setOpen(null)}
      />
    </Pagina>
  );
}
