// src/pages/budget/BudgetVasteLasten.tsx — fixed costs and the subscription radar
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { CalendarClock, Check, CircleCheck, Plus, Radar, Sparkles, TrendingUp } from "lucide-react";
import { useBedragen } from "@/features/budget/components/Bedrag";
import { Blad, PotKiezer, Wissel } from "@/features/budget/components/Blad";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { Kaart, Knop, Pagina, Sectie, Veld, foutTekst } from "@/features/budget/components/ui";
import { usePotjes } from "@/features/budget/hooks/useBudget";
import {
  useBewaarVasteLast,
  useMarkeerBekeken,
  useNieuwePrijs,
  useTransacties,
  useVasteLasten,
  useVerwijderVasteLast,
  type VasteLastInvoer,
} from "@/features/budget/hooks/useBudgetData";
import { huidigeMaand, korteDatum, maandGrenzen, parseBedrag } from "@/features/budget/lib/budget";
import { herkenVasteLasten, jaarBedrag, komtEraan, maandBedrag, vasteLastenDezeMaand } from "@/features/budget/lib/inzicht";
import type { BudgetPot, BudgetRecurring, BudgetScope } from "@/features/budget/types";

const HALFJAAR = 182 * 86400000;
const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export default function BudgetVasteLasten() {
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const hhId = huishouden.household.id;
  const { euro, euroRond } = useBedragen();
  const maand = huidigeMaand();
  const { data: lasten = [], isLoading } = useVasteLasten(hhId);
  const { data: potjes = [] } = usePotjes(hhId);
  const { data: tx4 = [] } = useTransacties(hhId, maand, 4);
  const bewaar = useBewaarVasteLast();
  const nieuwePrijs = useNieuwePrijs();
  const bekeken = useMarkeerBekeken();
  const [sheet, setSheet] = useState<{ open: boolean; last?: BudgetRecurring; voorinvulling?: Partial<VasteLastInvoer> }>({ open: false });

  const { van } = maandGrenzen(maand);
  const dezeMaandTx = useMemo(() => tx4.filter((t) => t.booked_on >= van), [tx4, van]);
  const statussen = useMemo(() => vasteLastenDezeMaand(lasten, dezeMaandTx, maand), [lasten, dezeMaandTx, maand]);
  const aankomend = komtEraan(statussen);
  const prijsWijzigingen = statussen.filter((s) => s.nieuwePrijs !== null);
  const herkend = useMemo(() => herkenVasteLasten(tx4, lasten), [tx4, lasten]);
  const abonnementen = lasten.filter((l) => l.is_subscription);
  const overig = lasten.filter((l) => !l.is_subscription);
  const totaal = {
    maand: lasten.reduce((s, l) => s + maandBedrag(l), 0),
    jaar: lasten.reduce((s, l) => s + jaarBedrag(l), 0),
    abo: abonnementen.reduce((s, l) => s + jaarBedrag(l), 0),
  };
  const statusVan = (id: string) => statussen.find((s) => s.last.id === id);

  return (
    <Pagina
      titel="Vaste lasten"
      sub="Wat elke maand of elk jaar terugkomt."
      terug={{ naar: "/budget/meer", label: "Meer" }}
      actie={
        <Knop onClick={() => setSheet({ open: true })} className="shrink-0">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Toevoegen</span>
        </Knop>
      }
    >
      <div className="max-w-2xl space-y-7">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Per maand", waarde: euroRond(totaal.maand) },
            { label: "Per jaar", waarde: euroRond(totaal.jaar) },
            { label: "Abonnementen", waarde: euroRond(totaal.abo), hint: "per jaar" },
          ].map((t) => (
            <Kaart key={t.label} className="px-3.5 py-3">
              <p className="text-xs text-kb-ink2">{t.label}</p>
              <p className="mt-1 text-lg font-semibold tracking-tight">{t.waarde}</p>
              {t.hint && <p className="text-[0.68rem] text-kb-ink3">{t.hint}</p>}
            </Kaart>
          ))}
        </div>

        {prijsWijzigingen.length > 0 && (
          <Sectie titel="Prijs veranderd">
            <Kaart className="divide-y divide-kb-line overflow-hidden">
              {prijsWijzigingen.map((s) => (
                <div key={s.last.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-kb-warn-soft text-kb-warn-ink">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.last.name}</p>
                    <p className="text-xs text-kb-ink2">
                      {euro(s.last.amount)} → {euro(s.nieuwePrijs!)} · {euroRond((s.nieuwePrijs! - s.last.amount) * (s.last.cadence === "jaar" ? 1 : 12))} per jaar{" "}
                      {s.nieuwePrijs! > s.last.amount ? "meer" : "minder"}
                    </p>
                  </div>
                  <Knop variant="zacht" className="min-h-[2.25rem] px-3" onClick={() => nieuwePrijs.mutate({ last: s.last, bedrag: s.nieuwePrijs! })}>
                    Bijwerken
                  </Knop>
                </div>
              ))}
            </Kaart>
          </Sectie>
        )}

        {aankomend.length > 0 && (
          <Sectie titel="Komt deze maand nog" aside={<span className="text-xs text-kb-ink2">{euro(aankomend.reduce((s, a) => s + a.last.amount, 0))}</span>}>
            <Kaart className="divide-y divide-kb-line overflow-hidden">
              {aankomend.map((a) => (
                <div key={a.last.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl bg-kb-sunk leading-none">
                    <span className="text-sm font-semibold">{a.vervaldag}</span>
                    <span className="text-[0.58rem] uppercase text-kb-ink2">{MAANDEN[maand.month - 1]}</span>
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{a.last.name}</p>
                  <p className="text-sm tabular-nums">{euro(a.last.amount)}</p>
                </div>
              ))}
            </Kaart>
          </Sectie>
        )}

        {herkend.length > 0 && (
          <Sectie titel="Herkend in je transacties">
            <Kaart className="divide-y divide-kb-line overflow-hidden">
              {herkend.slice(0, 6).map((h) => (
                <div key={h.tegenpartij} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-kb-accent-soft text-kb-accent-ink">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{h.naam}</p>
                    <p className="text-xs text-kb-ink2">
                      {euro(h.bedrag)} rond de {h.dag}e · {h.maanden} maanden gezien
                    </p>
                  </div>
                  <Knop
                    variant="zacht"
                    className="min-h-[2.25rem] px-3"
                    disabled={bewaar.isPending}
                    onClick={async () => {
                      try {
                        await bewaar.mutateAsync({
                          householdId: hhId,
                          invoer: {
                            name: h.naam,
                            counterparty: h.tegenpartij,
                            amount: h.bedrag,
                            cadence: "maand",
                            day_of_month: h.dag,
                            month_of_year: null,
                            is_subscription: h.lijktAbonnement,
                            pot_id: h.potId,
                            scope: "shared",
                            source: "herkend",
                          },
                        });
                        toast.success(`${h.naam} toegevoegd`);
                      } catch (err) {
                        toast.error(foutTekst(err));
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" /> Volgen
                  </Knop>
                </div>
              ))}
            </Kaart>
          </Sectie>
        )}

        {[
          { titel: "Abonnementen", lijst: abonnementen, radar: true },
          { titel: "Overige vaste lasten", lijst: overig, radar: false },
        ]
          .filter((g) => g.lijst.length > 0)
          .map((g) => (
            <Sectie key={g.titel} titel={g.titel}>
              <Kaart className="divide-y divide-kb-line overflow-hidden">
                {g.lijst.map((l) => {
                  const st = statusVan(l.id);
                  const nakijken = g.radar && (!l.reviewed_at || Date.now() - new Date(l.reviewed_at).getTime() > HALFJAAR);
                  return (
                    <div key={l.id} className="px-4 py-3">
                      <button type="button" onClick={() => setSheet({ open: true, last: l })} className="flex w-full items-center gap-3 text-left">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{l.name}</p>
                          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-kb-ink2">
                            {l.cadence === "jaar" ? `Jaarlijks in ${MAANDEN[(l.month_of_year ?? 1) - 1]}` : `Rond de ${l.day_of_month}e`}
                            {g.radar && <span>· {euroRond(jaarBedrag(l))} per jaar</span>}
                            {l.previous_amount !== null && l.previous_amount < l.amount && (
                              <span className="inline-flex items-center gap-0.5 font-medium text-kb-warn-ink">
                                <TrendingUp className="h-3 w-3" /> was {euro(l.previous_amount)}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium tabular-nums">{euro(l.amount)}</p>
                          {st?.dezeMaand && (
                            <p className={`flex items-center justify-end gap-1 text-[0.7rem] ${st.betaald ? "text-kb-good-ink" : "text-kb-ink2"}`}>
                              {st.betaald ? (
                                <>
                                  <CircleCheck className="h-3 w-3" /> betaald
                                </>
                              ) : (
                                <>
                                  <CalendarClock className="h-3 w-3" /> {korteDatum(maand, st.vervaldag)}
                                </>
                              )}
                            </p>
                          )}
                        </div>
                      </button>
                      {nakijken && (
                        <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-kb-sunk px-3 py-2">
                          <Radar className="h-4 w-4 shrink-0 text-kb-accent-ink" />
                          <p className="flex-1 text-xs text-kb-ink2">Gebruik je dit nog genoeg voor {euroRond(jaarBedrag(l))} per jaar?</p>
                          <button type="button" onClick={() => bekeken.mutate(l.id)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-kb-accent-ink hover:bg-kb-surface">
                            <Check className="h-3.5 w-3.5" /> Ja
                          </button>
                          <button type="button" onClick={() => setSheet({ open: true, last: l })} className="rounded-lg px-2 py-1 text-xs font-medium text-kb-ink2 hover:bg-kb-surface">
                            Opzeggen
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Kaart>
            </Sectie>
          ))}

        {!isLoading && lasten.length === 0 && herkend.length === 0 && (
          <Kaart className="px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-kb-accent-soft text-kb-accent-ink">
              <CalendarClock className="h-5 w-5" />
            </div>
            <p className="mt-4 font-medium">Nog geen vaste lasten</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-kb-ink2">
              Voeg huur, energie en abonnementen toe. Na het koppelen van ING herkent de app ze ook
              zelf. Dan zie je wat er deze maand nog afgaat, en hoor je het als iets duurder wordt.
            </p>
          </Kaart>
        )}
      </div>

      <VasteLastSheet
        open={sheet.open}
        last={sheet.last}
        potjes={potjes}
        householdId={hhId}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
      />
    </Pagina>
  );
}

function VasteLastSheet({
  open,
  last,
  potjes,
  householdId,
  onOpenChange,
}: {
  open: boolean;
  last?: BudgetRecurring;
  potjes: BudgetPot[];
  householdId: string;
  onOpenChange: (o: boolean) => void;
}) {
  const [naam, setNaam] = useState("");
  const [tegenpartij, setTegenpartij] = useState("");
  const [bedrag, setBedrag] = useState("");
  const [cadence, setCadence] = useState<"maand" | "jaar">("maand");
  const [dag, setDag] = useState("1");
  const [maandVanJaar, setMaandVanJaar] = useState(1);
  const [abo, setAbo] = useState(false);
  const [potId, setPotId] = useState<string | null>(null);
  const [scope, setScope] = useState<BudgetScope>("shared");
  const [zeker, setZeker] = useState(false);
  const bewaar = useBewaarVasteLast();
  const verwijder = useVerwijderVasteLast();

  useEffect(() => {
    if (!open) return;
    setNaam(last?.name ?? "");
    setTegenpartij(last?.counterparty ?? "");
    setBedrag(last ? String(last.amount).replace(".", ",") : "");
    setCadence(last?.cadence ?? "maand");
    setDag(String(last?.day_of_month ?? 1));
    setMaandVanJaar(last?.month_of_year ?? new Date().getMonth() + 1);
    setAbo(last?.is_subscription ?? false);
    setPotId(last?.pot_id ?? potjes.find((p) => p.kind === "vast")?.id ?? null);
    setScope(last?.scope ?? "shared");
    setZeker(false);
  }, [open, last, potjes]);

  const verstuur = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await bewaar.mutateAsync({
        householdId,
        id: last?.id,
        invoer: {
          name: naam,
          counterparty: tegenpartij || naam,
          amount: parseBedrag(bedrag),
          cadence,
          day_of_month: Math.min(31, Math.max(1, Number(dag) || 1)),
          month_of_year: cadence === "jaar" ? maandVanJaar : null,
          is_subscription: abo,
          pot_id: potId,
          scope,
        },
      });
      toast.success(last ? "Bijgewerkt" : "Toegevoegd");
      onOpenChange(false);
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  return (
    <Blad open={open} onOpenChange={onOpenChange} titel={last ? last.name : "Vaste last toevoegen"}>
      <form onSubmit={verstuur} className="space-y-4">
        <Veld label="Naam" placeholder="Bijv. Huur of Netflix" value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={60} required />
        <Veld label="Bedrag (€)" inputMode="decimal" value={bedrag} onChange={(e) => setBedrag(e.target.value)} required />
        <Wissel<"maand" | "jaar">
          opties={[
            { id: "maand", titel: "Elke maand" },
            { id: "jaar", titel: "Elk jaar" },
          ]}
          waarde={cadence}
          onChange={setCadence}
        />
        <div className="grid grid-cols-2 gap-3">
          <Veld label="Rond de dag" inputMode="numeric" value={dag} onChange={(e) => setDag(e.target.value.replace(/\D/g, ""))} />
          {cadence === "jaar" && (
            <div>
              <label htmlFor="vl-maand" className="mb-1.5 block text-sm font-medium">
                In de maand
              </label>
              <select
                id="vl-maand"
                value={maandVanJaar}
                onChange={(e) => setMaandVanJaar(Number(e.target.value))}
                className="h-12 w-full rounded-xl border border-kb-line-strong bg-white px-3 text-base"
              >
                {MAANDEN.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <Veld
          label="Naam op je afschrift"
          placeholder={naam || "Bijv. Vesteda"}
          value={tegenpartij}
          onChange={(e) => setTegenpartij(e.target.value)}
          hint="Hiermee herkent de app de betaling en ziet hij of de prijs verandert."
        />
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={abo} onChange={(e) => setAbo(e.target.checked)} className="h-4 w-4 accent-kb-accent" />
          Abonnement (komt in de abonnementen-radar)
        </label>
        <div>
          <p className="mb-2 text-sm font-medium">Uit welk potje?</p>
          <PotKiezer potjes={potjes} waarde={potId} onKies={setPotId} metGeen />
        </div>
        <Wissel<BudgetScope>
          opties={[
            { id: "shared", titel: "Gedeeld" },
            { id: "personal", titel: "Persoonlijk" },
          ]}
          waarde={scope}
          onChange={setScope}
        />
        <div className="flex flex-col gap-2 pt-1">
          <Knop type="submit" disabled={bewaar.isPending}>
            {last ? "Opslaan" : "Toevoegen"}
          </Knop>
          {last && (
            <Knop
              type="button"
              variant="gevaar"
              onClick={async () => {
                if (!zeker) return setZeker(true);
                await verwijder.mutateAsync(last.id);
                toast.success(last.is_subscription ? "Opgezegd en weggehaald" : "Weggehaald");
                onOpenChange(false);
              }}
            >
              {zeker ? "Zeker weten? Tik nogmaals" : last.is_subscription ? "Opgezegd — weghalen" : "Weghalen"}
            </Knop>
          )}
        </div>
      </form>
    </Blad>
  );
}
