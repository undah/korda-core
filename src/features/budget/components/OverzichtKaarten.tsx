// src/features/budget/components/OverzichtKaarten.tsx — the smaller cards on the overview
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CopyX,
  Handshake,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { usePotjes, useUitgavenPerPotje, useZetGroep } from "../hooks/useBudget";
import {
  useAfsluitingen,
  useDoelen,
  useGedeeldBetaald,
  useSluitMaandAf,
  useTransacties,
  useVerrekeningen,
} from "../hooks/useBudgetData";
import { huidigeMaand, isZelfdeMaand, korteDatum, maandGrenzen, maandNaam, verschuifMaand } from "../lib/budget";
import {
  GROEPEN,
  dubbeleAfschrijvingen,
  inkomenPerMaand,
  inkomenVan,
  maandRestant,
  overboekingen,
  verdeling,
  verrekenSaldi,
  weekoverzicht,
  type VasteLastStatus,
} from "../lib/inzicht";
import type { BudgetMonth, BudgetPot, PotGroep, TxMetDelen } from "../types";
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
    <Link
      to="/budget/week"
      className="block rounded-2xl border border-kb-line bg-kb-surface p-4 transition-colors hover:bg-kb-sunk/60"
    >
      <p className="flex items-center justify-between text-sm font-semibold">
        Afgelopen 7 dagen <ChevronRight className="h-4 w-4 text-kb-ink3" />
      </p>
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
    </Link>
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

// ─── dubbel afgeschreven ─────────────────────────────────────────────────────

const korteDag = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00`));

function leesNegeer(sleutel: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(sleutel) ?? "[]"));
  } catch {
    return new Set();
  }
}

/** Same shop, same amount, within a few days: worth a look. Dismissed pairs are remembered on this device. */
export function DubbelKaart({ householdId }: { householdId: string }) {
  const { euro } = useBedragen();
  const { data: transacties = [] } = useTransacties(householdId, huidigeMaand(), 2);
  const opslag = `kb-dubbel-ok:${householdId}`;
  const [negeer, setNegeer] = useState(() => leesNegeer(opslag));
  const paren = useMemo(() => dubbeleAfschrijvingen(transacties, negeer), [transacties, negeer]);
  if (paren.length === 0) return null;

  const klopt = (sleutel: string) => {
    const nieuw = new Set(negeer).add(sleutel);
    setNegeer(nieuw);
    try {
      localStorage.setItem(opslag, JSON.stringify([...nieuw]));
    } catch {
      // Not remembered in private mode; it's dismissed for this visit.
    }
  };

  return (
    <Kaart className="overflow-hidden">
      <div className="flex items-center gap-2 bg-kb-warn-soft px-4 py-3 text-sm font-semibold text-kb-warn-ink">
        <CopyX className="h-4 w-4" /> Mogelijk dubbel afgeschreven
      </div>
      <ul className="divide-y divide-kb-line">
        {paren.slice(0, 3).map((p) => (
          <li key={p.sleutel} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium">{p.a.counterparty ?? p.a.description}</p>
              <p className="shrink-0 text-sm font-medium tabular-nums">2 × {euro(Math.abs(p.a.amount))}</p>
            </div>
            <p className="text-xs text-kb-ink2">
              {p.dagen === 0 ? `Twee keer op ${korteDag(p.a.booked_on)}` : `${korteDag(p.a.booked_on)} en ${korteDag(p.b.booked_on)}`}
              {p.a.account_id !== p.b.account_id && " · van twee rekeningen"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button type="button" onClick={() => klopt(p.sleutel)} className="text-xs font-medium text-kb-accent-ink hover:underline">
                Klopt, was twee keer
              </button>
              <span className="text-xs text-kb-ink2">Fout? Vraag het terug bij de winkel of je bank.</span>
            </div>
          </li>
        ))}
      </ul>
    </Kaart>
  );
}

// ─── nodig / wil / sparen ────────────────────────────────────────────────────

const KLEUR: Record<PotGroep, string> = { nodig: "bg-kb-nodig", wil: "bg-kb-wil", sparen: "bg-kb-sparen" };
const pct = (deel: number, geheel: number) => (geheel > 0 ? Math.round((deel / geheel) * 100) : 0);

/**
 * How this month's spending splits into needs, wants and saving, measured
 * against income (this month's, or last month's when salary hasn't come in
 * yet). Without income it shows the split of spending, and asks to mark it.
 */
export function VerdelingKaart({
  householdId,
  maand,
  potjes,
  uitgaven,
}: {
  householdId: string;
  maand: BudgetMonth;
  potjes: BudgetPot[];
  uitgaven: Record<string, number>;
}) {
  const { euro } = useBedragen();
  const { data: tx = [] } = useTransacties(householdId, maand, 2);
  // Three months back from today, for the typical monthly income.
  const { data: recent = [] } = useTransacties(householdId, huidigeMaand(), 4);
  const [indelen, setIndelen] = useState(false);
  const zetGroep = useZetGroep(householdId);

  const { inkomen, bron } = useMemo(() => {
    const start = maandGrenzen(maand).van;
    const deze = inkomenVan(tx.filter((t) => t.booked_on >= start));
    // A past month had its income; this one is still coming in, so use the
    // typical month (weekly pay would otherwise look short until month end).
    if (!isZelfdeMaand(maand, huidigeMaand())) return { inkomen: deze, bron: "die maand" };
    const gemiddeld = inkomenPerMaand(recent).perMaand;
    if (gemiddeld > 0) return { inkomen: gemiddeld, bron: "per maand, gemiddeld" };
    if (deze > 0) return { inkomen: deze, bron: "deze maand tot nu" };
    const vorige = inkomenVan(tx.filter((t) => t.booked_on < start));
    return { inkomen: vorige, bron: vorige > 0 ? `van ${maandNaam(verschuifMaand(maand, -1)).split(" ")[0]}` : "" };
  }, [tx, recent, maand]);
  const v = useMemo(() => verdeling(potjes, uitgaven, inkomen), [potjes, uitgaven, inkomen]);
  if (potjes.length === 0) return null;

  const geheel = inkomen > 0 ? Math.max(inkomen, v.uitgegeven) : v.uitgegeven;
  const segmenten = [
    ...GROEPEN.map((g) => ({ id: g.id as string, klasse: KLEUR[g.id], bedrag: v.per[g.id], titel: g.titel })),
    { id: "zonder", klasse: "bg-kb-ink3", bedrag: v.per.zonder, titel: "Geen groep" },
  ].filter((x) => x.bedrag > 0);
  const passend = inkomen > 0 ? inkomen - v.totaalBudget : null;

  return (
    <Kaart className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold">Nodig, wil, sparen</p>
        {inkomen > 0 && (
          <p className="text-xs text-kb-ink2">
            Inkomen {bron}: <span className="font-medium tabular-nums text-kb-ink">{euro(inkomen)}</span>
          </p>
        )}
      </div>

      {/* One bar: each group's share of income (or of spending); the track is what's left. */}
      <div
        className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-kb-sunk"
        role="img"
        aria-label={segmenten.map((x) => `${x.titel} ${euro(x.bedrag)}`).join(", ")}
      >
        {segmenten.map((x) => (
          <div
            key={x.id}
            className={`${x.klasse} h-full`}
            style={{ width: `${(x.bedrag / (geheel || 1)) * 100}%` }}
            title={`${x.titel}: ${euro(x.bedrag)}`}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-2.5">
        {GROEPEN.map((g) => {
          const bedrag = v.per[g.id] + (g.id === "sparen" && inkomen > 0 ? Math.max(0, v.over) : 0);
          return (
            <li key={g.id} className="flex items-center gap-3 text-sm">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${KLEUR[g.id]}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{g.titel}</span>
                <span className="block text-xs text-kb-ink2">
                  {g.id === "sparen" && inkomen > 0 ? "Gespaard plus nog niet uitgegeven" : g.uitleg}
                </span>
              </span>
              <span className="text-right tabular-nums">
                <span className="block font-medium">{euro(bedrag)}</span>
                <span className="block text-xs text-kb-ink2">
                  {pct(bedrag, inkomen > 0 ? inkomen : v.uitgegeven)}% · richtlijn {Math.round(g.richtlijn * 100)}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {passend !== null ? (
        <p className={`mt-4 flex items-start gap-2 text-sm ${passend < 0 ? "text-kb-crit-ink" : "text-kb-good-ink"}`}>
          {passend < 0 ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>
            {passend < 0
              ? `Je potjes samen (${euro(v.totaalBudget)}) zijn ${euro(-passend)} meer dan je inkomen.`
              : `Je potjes samen (${euro(v.totaalBudget)}) passen in je inkomen; ${euro(passend)} is niet verdeeld.`}
          </span>
        </p>
      ) : (
        <p className="mt-4 text-xs text-kb-ink2">
          Markeer je salaris als inkomen (tik in{" "}
          <Link to="/budget/transacties" className="font-medium text-kb-accent-ink underline">
            Transacties
          </Link>{" "}
          op de bijschrijving), dan zie je of je potjes in je inkomen passen.
        </p>
      )}

      {v.zonderGroep.length > 0 && (
        <button type="button" onClick={() => setIndelen(true)} className="mt-3 text-sm font-medium text-kb-accent-ink hover:underline">
          {v.zonderGroep.length === 1 ? "1 potje heeft nog geen groep" : `${v.zonderGroep.length} potjes hebben nog geen groep`} →
        </button>
      )}

      <Blad open={indelen} onOpenChange={setIndelen} titel="Potjes indelen" beschrijving="Nodig, wil of sparen? Tik per potje.">
        <ul className="space-y-3">
          {potjes.map((p) => (
            <li key={p.id} className="rounded-xl border border-kb-line p-3">
              <p className="text-sm font-medium">
                {p.emoji} {p.name}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {GROEPEN.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={p.groep === g.id}
                    onClick={() => zetGroep.mutate({ potId: p.id, groep: g.id }, { onError: (e) => toast.error(foutTekst(e)) })}
                    className={`flex min-h-[2.5rem] items-center justify-center gap-1.5 rounded-lg border text-sm ${
                      p.groep === g.id ? "border-kb-accent bg-kb-accent-soft font-medium text-kb-accent-ink" : "border-kb-line-strong bg-white"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${KLEUR[g.id]}`} aria-hidden /> {g.titel}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Blad>
    </Kaart>
  );
}
