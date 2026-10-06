// src/features/budget/components/OverzichtKaarten.tsx — the smaller cards on the overview
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarCheck2, CalendarClock, ChevronRight, Handshake, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { usePotjes, useUitgavenPerPotje } from "../hooks/useBudget";
import {
  useAfsluitingen,
  useDoelen,
  useGedeeldBetaald,
  useSluitMaandAf,
  useVerrekeningen,
} from "../hooks/useBudgetData";
import { huidigeMaand, korteDatum, maandGrenzen, maandNaam, verschuifMaand } from "../lib/budget";
import { maandRestant, overboekingen, verrekenSaldi, weekoverzicht, type VasteLastStatus } from "../lib/inzicht";
import type { BudgetPot, TxMetDelen } from "../types";
import type { Huishouden } from "../hooks/useBudget";
import { useBedragen } from "./Bedrag";
import { Blad } from "./Blad";
import { Kaart, Knop, foutTekst } from "./ui";

export function KomtEraanKaart({ aankomend }: { aankomend: VasteLastStatus[] }) {
  const { euro } = useBedragen();
  const maand = huidigeMaand();
  if (aankomend.length === 0) return null;
  const totaal = aankomend.reduce((s, a) => s + a.last.amount, 0);
  return (
    <Kaart className="overflow-hidden">
      <Link to="/budget/vaste-lasten" className="flex items-center justify-between gap-3 px-4 pb-1 pt-4 hover:underline">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-kb-accent-ink" /> Komt deze maand nog
        </span>
        <span className="text-sm tabular-nums text-kb-ink2">{euro(totaal)}</span>
      </Link>
      <ul className="px-4 pb-3">
        {aankomend.slice(0, 4).map((a) => (
          <li key={a.last.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="min-w-0 truncate">
              <span className="mr-2 inline-block w-12 text-xs text-kb-ink2">{korteDatum(maand, a.vervaldag)}</span>
              {a.last.name}
            </span>
            <span className="tabular-nums text-kb-ink2">{euro(a.last.amount)}</span>
          </li>
        ))}
        {aankomend.length > 4 && <li className="pt-1 text-xs text-kb-ink2">en nog {aankomend.length - 4}…</li>}
      </ul>
    </Kaart>
  );
}

export function VerrekenKaart({ huishouden }: { huishouden: Huishouden }) {
  const { user } = useAuth();
  const { euro } = useBedragen();
  const hhId = huishouden.household.id;
  const { data: betaald } = useGedeeldBetaald(huishouden.members.length > 1 ? hhId : undefined);
  const { data: verrekeningen = [] } = useVerrekeningen(huishouden.members.length > 1 ? hhId : undefined);
  if (huishouden.members.length < 2 || !betaald) return null;
  const advies = overboekingen(verrekenSaldi(huishouden.members, betaald.perPersoon, betaald.totaal, verrekeningen));
  const mijn = advies.find((a) => a.van.userId === user?.id || a.naar.userId === user?.id) ?? advies[0];
  if (!mijn) return null;
  const tekst =
    mijn.van.userId === user?.id
      ? `Jij maakt nog ${euro(mijn.bedrag)} over aan ${mijn.naar.naam}`
      : mijn.naar.userId === user?.id
        ? `${mijn.van.naam} maakt nog ${euro(mijn.bedrag)} aan jou over`
        : `${mijn.van.naam} maakt ${euro(mijn.bedrag)} over aan ${mijn.naar.naam}`;
  return (
    <Link to="/budget/verrekenen" className="flex items-center gap-3 rounded-2xl border border-kb-line bg-kb-surface px-4 py-3.5 hover:bg-kb-sunk/60">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-kb-accent-soft text-kb-accent-ink">
        <Handshake className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Verrekenen</span>
        <span className="block text-xs text-kb-ink2">{tekst}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-kb-ink3" />
    </Link>
  );
}

export function WeekKaart({ transacties, potjes }: { transacties: TxMetDelen[]; potjes: BudgetPot[] }) {
  const { euro } = useBedragen();
  const w = useMemo(() => weekoverzicht(transacties, potjes), [transacties, potjes]);
  if (w.deze === 0 && w.vorige === 0) return null;
  const meer = w.verschil > 0;
  return (
    <Kaart className="p-4">
      <p className="text-sm font-semibold">Afgelopen 7 dagen</p>
      <p className="text-xs text-kb-ink2">Dagelijkse uitgaven, zonder vaste lasten</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{euro(w.deze)}</p>
      {w.vorige > 0 && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-kb-ink2">
          {meer ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {euro(Math.abs(w.verschil))} {meer ? "meer" : "minder"} dan de week ervoor
        </p>
      )}
      {w.topPot?.pot && (
        <p className="mt-2 text-xs text-kb-ink2">
          Meeste in {w.topPot.pot.emoji} {w.topPot.pot.name}: {euro(w.topPot.bedrag)}
        </p>
      )}
    </Kaart>
  );
}

/**
 * At the start of a month: close last month and send what's left in the shared
 * pots to a savings goal. Shown until someone in the household has done it.
 */
export function MaandAfsluiting({ huishouden }: { huishouden: Huishouden }) {
  const { euro } = useBedragen();
  const hhId = huishouden.household.id;
  const vorige = verschuifMaand(huidigeMaand(), -1);
  const { data: afsluitingen, isLoading } = useAfsluitingen(hhId);
  const { data: potjes = [] } = usePotjes(hhId);
  const { data: uitgaven = {} } = useUitgavenPerPotje(hhId, vorige);
  const { data: doelen = [] } = useDoelen(hhId);
  const sluit = useSluitMaandAf();
  const [open, setOpen] = useState(false);
  const gedeeldeDoelen = doelen.filter((d) => d.scope === "shared");
  const [doelId, setDoelId] = useState<string | null>(null);

  useEffect(() => {
    setDoelId(gedeeldeDoelen.find((d) => d.receives_leftover)?.id ?? gedeeldeDoelen[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doelen.length]);

  const restant = useMemo(() => maandRestant(potjes, uitgaven), [potjes, uitgaven]);
  const vorigeStart = maandGrenzen(vorige).van;
  const bestondAl = huishouden.household.created_at.slice(0, 10) < maandGrenzen(huidigeMaand()).van;
  const alGedaan = afsluitingen?.some((a) => a.month === vorigeStart);
  if (isLoading || alGedaan || !bestondAl || potjes.length === 0) return null;

  const naam = maandNaam(vorige).split(" ")[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-kb-accent/30 bg-kb-accent-soft px-4 py-3.5 text-left hover:bg-kb-accent-soft/70"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-kb-surface text-kb-accent-ink">
          <CalendarCheck2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-kb-accent-ink first-letter:uppercase">{naam} afsluiten</span>
          <span className="block text-xs text-kb-ink2">
            {restant.totaal > 0 ? `${euro(restant.totaal)} over in de gedeelde potjes` : "Kijk terug op vorige maand"}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-kb-accent-ink" />
      </button>

      <Blad open={open} onOpenChange={setOpen} titel={<span className="first-letter:uppercase">{maandNaam(vorige)}</span>} beschrijving="Zo ging het. Wat over is, zet je opzij.">
        <ul className="divide-y divide-kb-line rounded-2xl border border-kb-line">
          {restant.regels.map((r) => (
            <li key={r.pot.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="truncate">
                {r.pot.emoji} {r.pot.name}
              </span>
              <span className={`tabular-nums ${r.restant < 0 ? "text-kb-crit-ink" : r.restant > 0 ? "text-kb-good-ink" : "text-kb-ink2"}`}>
                {r.restant > 0 ? "+" : r.restant < 0 ? "−" : ""}
                {euro(Math.abs(r.restant))}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-2xl bg-kb-sunk px-4 py-3">
          <p className="text-sm text-kb-ink2">Over om te sparen</p>
          <p className="text-3xl font-semibold tracking-tight">{euro(restant.totaal)}</p>
          {restant.tekort < 0 && (
            <p className="mt-1 text-xs text-kb-ink2">
              Potjes die over hun limiet gingen ({euro(-restant.tekort)}) tellen niet mee; dat geld is al uitgegeven.
            </p>
          )}
        </div>

        {restant.totaal > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Naar welk doel?</p>
            {gedeeldeDoelen.length === 0 ? (
              <p className="text-sm text-kb-ink2">
                Je hebt nog geen gedeeld spaardoel.{" "}
                <Link to="/budget/doelen" className="font-medium text-kb-accent-ink underline" onClick={() => setOpen(false)}>
                  Maak er een
                </Link>{" "}
                of sluit af zonder.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {[...gedeeldeDoelen.map((d) => ({ id: d.id, label: `${d.emoji} ${d.name}` })), { id: null, label: "Niet opzij zetten" }].map((o) => (
                  <button
                    key={o.id ?? "geen"}
                    type="button"
                    aria-pressed={doelId === o.id}
                    onClick={() => setDoelId(o.id)}
                    className={`min-h-[2.5rem] rounded-full border px-3 text-sm ${doelId === o.id ? "border-kb-accent bg-kb-accent-soft font-medium text-kb-accent-ink" : "border-kb-line-strong bg-white"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Knop
          className="mt-5 w-full"
          disabled={sluit.isPending}
          onClick={async () => {
            try {
              await sluit.mutateAsync({ householdId: hhId, maand: vorige, restant: restant.totaal, goalId: doelId });
              toast.success(doelId && restant.totaal > 0 ? `${euro(restant.totaal)} opzij gezet` : `${naam} afgesloten`);
              setOpen(false);
            } catch (err) {
              toast.error(foutTekst(err));
            }
          }}
        >
          {naam.charAt(0).toUpperCase() + naam.slice(1)} afsluiten
        </Knop>
      </Blad>
    </>
  );
}
