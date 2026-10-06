// src/pages/budget/BudgetDoelen.tsx — savings goals, the buffer meter and the wish list
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { Clock, ExternalLink, Lock, Minus, Pencil, PiggyBank, Plus, ShieldCheck, Sparkles, Trophy, X } from "lucide-react";
import { useBedragen } from "@/features/budget/components/Bedrag";
import { Blad, Wissel } from "@/features/budget/components/Blad";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { Kaart, Knop, Pagina, Sectie, Veld, foutTekst } from "@/features/budget/components/ui";
import { usePotjes } from "@/features/budget/hooks/useBudget";
import {
  useArchiveerDoel,
  useBeslisWens,
  useBewaarDoel,
  useBoekOpDoel,
  useDoelen,
  useNieuweWens,
  useVasteLasten,
  useVerwijderWens,
  useWensen,
  useZetSpaarsaldo,
  type DoelMetSaldo,
} from "@/features/budget/hooks/useBudgetData";
import { parseBedrag } from "@/features/budget/lib/budget";
import { bufferMaanden } from "@/features/budget/lib/inzicht";
import type { BudgetScope, BudgetWish } from "@/features/budget/types";

const EMOJI = ["🎯", "✈️", "🏖️", "🏠", "🚗", "💍", "🎓", "👶", "🛟", "🎁", "💻", "🐶"];

function maandenTot(deadline: string, nu = new Date()) {
  const d = new Date(deadline);
  return Math.max(0, (d.getFullYear() - nu.getFullYear()) * 12 + d.getMonth() - nu.getMonth());
}
const maandJaar = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(new Date(iso));

export default function BudgetDoelen() {
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const hhId = huishouden.household.id;
  const { data: doelen = [], isLoading } = useDoelen(hhId);
  const [bewerk, setBewerk] = useState<{ open: boolean; doel?: DoelMetSaldo }>({ open: false });
  const [boek, setBoek] = useState<{ doel: DoelMetSaldo; soort: "storting" | "opname" } | null>(null);

  return (
    <Pagina
      titel="Doelen"
      sub="Waar je voor spaart, hoe ver je bent, en wat je nog wilt kopen."
      actie={
        <Knop onClick={() => setBewerk({ open: true })} className="shrink-0">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nieuw doel</span>
          <span className="sm:hidden">Nieuw</span>
        </Knop>
      }
    >
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-7">
          <Sectie titel="Spaardoelen">
            {!isLoading && doelen.length === 0 ? (
              <Kaart className="px-6 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-kb-accent-soft text-kb-accent-ink">
                  <PiggyBank className="h-5 w-5" />
                </div>
                <p className="mt-4 font-medium">Nog geen doelen</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-kb-ink2">
                  Bijvoorbeeld een buffer of een vakantie. Wat aan het eind van de maand in je potjes
                  over is, kan hier naartoe.
                </p>
                <Knop className="mt-5" onClick={() => setBewerk({ open: true })}>
                  Eerste doel maken
                </Knop>
              </Kaart>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {doelen.map((d) => (
                  <DoelKaart
                    key={d.id}
                    doel={d}
                    onBewerk={() => setBewerk({ open: true, doel: d })}
                    onBoek={(soort) => setBoek({ doel: d, soort })}
                  />
                ))}
              </div>
            )}
          </Sectie>
          <Wensenlijst householdId={hhId} />
        </div>
        <aside className="space-y-4 lg:sticky lg:top-10">
          <BufferKaart householdId={hhId} saldo={huishouden.household.savings_balance} />
        </aside>
      </div>

      <DoelSheet
        open={bewerk.open}
        doel={bewerk.doel}
        householdId={hhId}
        onOpenChange={(open) => setBewerk((b) => ({ ...b, open }))}
      />
      <BoekSheet boek={boek} householdId={hhId} onSluit={() => setBoek(null)} />
    </Pagina>
  );
}

function DoelKaart({
  doel,
  onBewerk,
  onBoek,
}: {
  doel: DoelMetSaldo;
  onBewerk: () => void;
  onBoek: (soort: "storting" | "opname") => void;
}) {
  const { euro, euroRond } = useBedragen();
  const deel = Math.min(1, Math.max(0, doel.saldo / doel.target));
  const nog = Math.max(0, doel.target - doel.saldo);
  const gehaald = nog <= 0.005;
  const maanden = doel.deadline ? maandenTot(doel.deadline) : null;
  const perMaand = maanden !== null && maanden > 0 ? nog / maanden : null;

  return (
    <Kaart className="flex flex-col p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-kb-sunk text-xl">
          {doel.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{doel.name}</p>
          <p className="flex items-center gap-1 text-xs text-kb-ink2">
            {doel.scope === "personal" && <Lock className="h-3 w-3" />}
            {doel.deadline ? `Voor ${maandJaar(doel.deadline)}` : "Zonder einddatum"}
          </p>
        </div>
        <button type="button" onClick={onBewerk} aria-label={`${doel.name} bewerken`} className="rounded-lg p-1.5 text-kb-ink3 hover:bg-kb-sunk hover:text-kb-ink">
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight">
        {euro(doel.saldo)}
        <span className="ml-1.5 text-sm font-normal text-kb-ink3">van {euroRond(doel.target)}</span>
      </p>
      <div
        role="meter"
        aria-label={`${doel.name}: ${Math.round(deel * 100)}% gespaard`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(deel * 100)}
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-kb-accent-soft"
      >
        <div className="h-full rounded-full bg-kb-accent transition-[width] duration-700" style={{ width: `${deel * 100}%` }} />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-kb-ink2">
        {gehaald ? (
          <>
            <Trophy className="h-3.5 w-3.5 text-kb-good-ink" />
            <span className="font-medium text-kb-good-ink">Gehaald</span>
          </>
        ) : perMaand !== null ? (
          `Nog ${euro(perMaand)} per maand om het te halen`
        ) : maanden === 0 ? (
          `Deadline is deze maand · nog ${euro(nog)}`
        ) : (
          `Nog ${euro(nog)} te gaan`
        )}
      </p>
      {doel.receives_leftover && (
        <p className="mt-1 flex items-center gap-1 text-xs text-kb-accent-ink">
          <Sparkles className="h-3 w-3" /> Krijgt het maandrestant
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Knop variant="zacht" onClick={() => onBoek("storting")} className="min-h-[2.5rem]">
          <Plus className="h-4 w-4" /> Erbij
        </Knop>
        <Knop variant="rustig" onClick={() => onBoek("opname")} disabled={doel.saldo <= 0} className="min-h-[2.5rem]">
          <Minus className="h-4 w-4" /> Eraf
        </Knop>
      </div>
    </Kaart>
  );
}

function DoelSheet({
  open,
  doel,
  householdId,
  onOpenChange,
}: {
  open: boolean;
  doel?: DoelMetSaldo;
  householdId: string;
  onOpenChange: (o: boolean) => void;
}) {
  const [naam, setNaam] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [doelBedrag, setDoelBedrag] = useState("");
  const [deadline, setDeadline] = useState("");
  const [scope, setScope] = useState<BudgetScope>("shared");
  const [restant, setRestant] = useState(false);
  const [zeker, setZeker] = useState(false);
  const bewaar = useBewaarDoel();
  const archiveer = useArchiveerDoel();

  useEffect(() => {
    if (!open) return;
    setNaam(doel?.name ?? "");
    setEmoji(doel?.emoji ?? EMOJI[0]);
    setDoelBedrag(doel ? String(doel.target).replace(".", ",") : "");
    setDeadline(doel?.deadline ?? "");
    setScope(doel?.scope ?? "shared");
    setRestant(doel?.receives_leftover ?? false);
    setZeker(false);
  }, [open, doel]);

  const verstuur = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await bewaar.mutateAsync({
        householdId,
        id: doel?.id,
        invoer: {
          name: naam,
          emoji,
          target: parseBedrag(doelBedrag),
          deadline: deadline || null,
          scope,
          receives_leftover: scope === "shared" && restant,
        },
      });
      toast.success(doel ? "Doel bijgewerkt" : "Doel toegevoegd");
      onOpenChange(false);
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  return (
    <Blad open={open} onOpenChange={onOpenChange} titel={doel ? "Doel bewerken" : "Nieuw spaardoel"}>
      <form onSubmit={verstuur} className="space-y-4">
        <Veld label="Naam" placeholder="Bijv. Buffer of Japan" value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={60} required />
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Icoon</legend>
          <div className="grid grid-cols-6 gap-1.5">
            {EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={emoji === e}
                aria-label={`Icoon ${e}`}
                onClick={() => setEmoji(e)}
                className={`flex aspect-square items-center justify-center rounded-xl text-xl ${emoji === e ? "bg-kb-accent-soft ring-2 ring-kb-accent" : "bg-kb-sunk"}`}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>
        <Veld label="Doelbedrag (€)" inputMode="decimal" placeholder="2000" value={doelBedrag} onChange={(e) => setDoelBedrag(e.target.value)} required />
        <Veld label="Wanneer wil je het hebben? (optioneel)" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} hint="Dan rekent de app uit hoeveel je per maand opzij moet zetten." />
        <Wissel<BudgetScope>
          opties={[
            { id: "shared", titel: "Gedeeld", uitleg: "Samen sparen" },
            { id: "personal", titel: "Persoonlijk", uitleg: "Alleen jij ziet het" },
          ]}
          waarde={scope}
          onChange={setScope}
        />
        {scope === "shared" && (
          <label className="flex items-start gap-2.5 rounded-xl bg-kb-sunk p-3 text-sm">
            <input type="checkbox" checked={restant} onChange={(e) => setRestant(e.target.checked)} className="mt-0.5 h-4 w-4 accent-kb-accent" />
            <span>
              <span className="font-medium">Maandrestant hierheen</span>
              <span className="block text-xs text-kb-ink2">Bij het afsluiten van een maand gaat wat over is standaard naar dit doel.</span>
            </span>
          </label>
        )}
        <div className="flex flex-col gap-2 pt-1">
          <Knop type="submit" disabled={bewaar.isPending}>
            {doel ? "Opslaan" : "Doel toevoegen"}
          </Knop>
          {doel && (
            <Knop
              type="button"
              variant="gevaar"
              onClick={async () => {
                if (!zeker) return setZeker(true);
                await archiveer.mutateAsync(doel.id);
                toast.success("Doel verwijderd");
                onOpenChange(false);
              }}
            >
              {zeker ? "Zeker weten? Tik nogmaals" : "Doel verwijderen"}
            </Knop>
          )}
        </div>
      </form>
    </Blad>
  );
}

function BoekSheet({
  boek,
  householdId,
  onSluit,
}: {
  boek: { doel: DoelMetSaldo; soort: "storting" | "opname" } | null;
  householdId: string;
  onSluit: () => void;
}) {
  const { euro } = useBedragen();
  const [bedrag, setBedrag] = useState("");
  const boekOp = useBoekOpDoel();
  useEffect(() => setBedrag(""), [boek]);

  return (
    <Blad
      open={!!boek}
      onOpenChange={(o) => !o && onSluit()}
      titel={boek ? `${boek.doel.emoji} ${boek.soort === "storting" ? "Erbij" : "Eraf"}` : ""}
      beschrijving={boek ? `${boek.doel.name} staat nu op ${euro(boek.doel.saldo)}.` : undefined}
    >
      {boek && (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const b = parseBedrag(bedrag);
            if (b <= 0) return toast.error("Vul een bedrag in");
            try {
              await boekOp.mutateAsync({ goalId: boek.doel.id, householdId, bedrag: b, kind: boek.soort });
              toast.success(boek.soort === "storting" ? "Bijgeschreven" : "Afgeschreven");
              onSluit();
            } catch (err) {
              toast.error(foutTekst(err));
            }
          }}
        >
          <Veld label="Bedrag (€)" inputMode="decimal" value={bedrag} onChange={(e) => setBedrag(e.target.value)} autoFocus required />
          <Knop type="submit" className="w-full" disabled={boekOp.isPending}>
            {boek.soort === "storting" ? "Bijschrijven" : "Afschrijven"}
          </Knop>
        </form>
      )}
    </Blad>
  );
}

/** How many months of fixed costs your savings would carry you through. */
function BufferKaart({ householdId, saldo }: { householdId: string; saldo: number | null }) {
  const { euro, euroRond } = useBedragen();
  const { data: potjes = [] } = usePotjes(householdId);
  const { data: lasten = [] } = useVasteLasten(householdId);
  const [bewerken, setBewerken] = useState(false);
  const [invoer, setInvoer] = useState("");
  const zet = useZetSpaarsaldo();
  const waarde = saldo === null ? null : Number(saldo);
  const { perMaand, maanden } = bufferMaanden(waarde, potjes, lasten);
  // Common advice: 3 to 6 months. The scale runs to 6, the 3-month mark is drawn.
  const schaal = 6;

  return (
    <Kaart className="p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-kb-accent-soft text-kb-accent-ink">
          <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <p className="text-sm font-semibold">Buffer</p>
      </div>
      {maanden !== null ? (
        <>
          <p className="mt-3 text-3xl font-semibold tracking-tight">
            {maanden >= 10 ? Math.round(maanden) : maanden.toFixed(1).replace(".", ",")}
            <span className="ml-1.5 text-sm font-normal text-kb-ink2">maanden</span>
          </p>
          <div className="relative mt-3">
            <div
              role="meter"
              aria-label={`Buffer: ${maanden.toFixed(1)} maanden vaste lasten`}
              aria-valuemin={0}
              aria-valuemax={schaal}
              aria-valuenow={Math.min(maanden, schaal)}
              className="h-2 overflow-hidden rounded-full bg-kb-accent-soft"
            >
              <div className="h-full rounded-full bg-kb-accent" style={{ width: `${Math.min(1, maanden / schaal) * 100}%` }} />
            </div>
            <span aria-hidden="true" className="absolute -top-1 h-4 w-[2px] bg-kb-ink/40" style={{ left: "50%" }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[0.68rem] text-kb-ink3">
            <span>0</span>
            <span>3 mnd advies</span>
            <span>6+</span>
          </div>
          <p className="mt-3 text-sm text-kb-ink2">
            {euroRond(waarde!)} spaargeld dekt je vaste lasten van {euroRond(perMaand)} per maand zo lang.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-kb-ink2">
          {perMaand > 0
            ? "Vul je spaarsaldo in om te zien hoeveel maanden vaste lasten je ermee kunt betalen."
            : "Markeer potjes als vast (huur, abonnementen) of voeg vaste lasten toe; vul daarna je spaarsaldo in."}
        </p>
      )}
      {bewerken ? (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await zet.mutateAsync({ householdId, saldo: parseBedrag(invoer) });
              setBewerken(false);
            } catch (err) {
              toast.error(foutTekst(err));
            }
          }}
        >
          <Veld label="Spaarsaldo (€)" inputMode="decimal" value={invoer} onChange={(e) => setInvoer(e.target.value)} className="flex-1" autoFocus />
          <Knop type="submit" className="mb-0.5">Opslaan</Knop>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setInvoer(waarde !== null ? String(waarde).replace(".", ",") : "");
            setBewerken(true);
          }}
          className="mt-3 text-sm font-medium text-kb-accent-ink hover:underline"
        >
          {waarde === null ? "Spaarsaldo invullen" : `Spaarsaldo aanpassen (${euro(waarde)})`}
        </button>
      )}
    </Kaart>
  );
}

const urenTot = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3600000));

/** Want something? Park it for 48 hours first; most impulses don't survive the wait. */
function Wensenlijst({ householdId }: { householdId: string }) {
  const { euro } = useBedragen();
  const { data: wensen = [] } = useWensen(householdId);
  const nieuw = useNieuweWens();
  const beslis = useBeslisWens();
  const verwijder = useVerwijderWens();
  const [naam, setNaam] = useState("");
  const [prijs, setPrijs] = useState("");
  const [url, setUrl] = useState("");
  const [, tik] = useState(0);

  // Re-render every minute so the countdown moves.
  useEffect(() => {
    const t = setInterval(() => tik((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const open = wensen.filter((w) => w.status === "wachten");
  const geschrapt = wensen.filter((w) => w.status === "geschrapt");
  const bespaard = useMemo(() => geschrapt.reduce((s, w) => s + (w.price ?? 0), 0), [geschrapt]);

  const voegToe = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await nieuw.mutateAsync({ householdId, naam, prijs: prijs ? parseBedrag(prijs) : null, url, scope: "personal" });
      setNaam("");
      setPrijs("");
      setUrl("");
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  return (
    <Sectie titel="Wensenlijst" aside={bespaard > 0 ? <span className="text-xs text-kb-good-ink">{euro(bespaard)} niet uitgegeven</span> : undefined}>
      <Kaart className="p-4">
        <p className="text-sm text-kb-ink2">
          Iets dat je wilt kopen? Zet het hier en wacht 48 uur. Wil je het daarna nog steeds, dan is
          het geen impuls.
        </p>
        <form onSubmit={voegToe} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
          <input
            aria-label="Wat wil je kopen"
            placeholder="Wat wil je kopen?"
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            maxLength={80}
            required
            className="h-11 rounded-xl border border-kb-line-strong bg-white px-3 text-base outline-none focus:border-kb-accent"
          />
          <input
            aria-label="Prijs"
            placeholder="€ prijs"
            inputMode="decimal"
            value={prijs}
            onChange={(e) => setPrijs(e.target.value)}
            className="h-11 rounded-xl border border-kb-line-strong bg-white px-3 text-base outline-none focus:border-kb-accent"
          />
          <input
            aria-label="Link (optioneel)"
            placeholder="Link (optioneel)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-11 rounded-xl border border-kb-line-strong bg-white px-3 text-base outline-none focus:border-kb-accent sm:col-span-2"
          />
          <Knop type="submit" variant="zacht" disabled={nieuw.isPending} className="sm:col-span-2">
            <Clock className="h-4 w-4" /> Parkeren voor 48 uur
          </Knop>
        </form>

        {open.length > 0 && (
          <ul className="mt-4 divide-y divide-kb-line border-t border-kb-line">
            {open.map((w) => (
              <WensRij key={w.id} wens={w} onBeslis={(status) => beslis.mutate({ id: w.id, status })} onVerwijder={() => verwijder.mutate(w.id)} />
            ))}
          </ul>
        )}
      </Kaart>
    </Sectie>
  );
}

function WensRij({
  wens,
  onBeslis,
  onVerwijder,
}: {
  wens: BudgetWish;
  onBeslis: (s: "gekocht" | "geschrapt") => void;
  onVerwijder: () => void;
}) {
  const { euro } = useBedragen();
  const uren = urenTot(wens.wait_until);
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {wens.name}
            {wens.url && (
              <a href={wens.url} target="_blank" rel="noreferrer" aria-label="Openen" className="text-kb-ink3 hover:text-kb-ink">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </p>
          <p className="text-xs text-kb-ink2">
            {wens.price !== null && `${euro(wens.price)} · `}
            {uren > 0 ? `nog ${uren} uur bedenktijd` : "Bedenktijd voorbij — wil je het nog?"}
          </p>
        </div>
        <button type="button" onClick={onVerwijder} aria-label={`${wens.name} weghalen`} className="rounded-lg p-1.5 text-kb-ink3 hover:bg-kb-sunk">
          <X className="h-4 w-4" />
        </button>
      </div>
      {uren === 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Knop variant="rustig" className="min-h-[2.5rem]" onClick={() => onBeslis("geschrapt")}>
            Toch niet
          </Knop>
          <Knop variant="zacht" className="min-h-[2.5rem]" onClick={() => onBeslis("gekocht")}>
            Gekocht
          </Knop>
        </div>
      )}
    </li>
  );
}
