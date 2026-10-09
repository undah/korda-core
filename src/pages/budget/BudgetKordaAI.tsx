// src/pages/budget/BudgetKordaAI.tsx — Korda AI: insights for the household, and questions.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowUp, Check, CheckCircle2, ChevronRight, Copy, Lightbulb, Loader2, RefreshCw, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { KordaAIFiguur, gezienSleutel } from "@/features/budget/components/KordaAI";
import { Kaart, Knop, Pagina, Sectie, foutTekst } from "@/features/budget/components/ui";
import { usePotjes } from "@/features/budget/hooks/useBudget";
import {
  useInzichten,
  useVerversInzichten,
  useVoerKordaVoorstelUit,
  vraagKordaAI,
  type KordaVoorstel,
} from "@/features/budget/hooks/useBudgetData";
import type { KordaInzicht } from "@/features/budget/types";

const SOORT: Record<KordaInzicht["soort"], { label: string; icoon: typeof Lightbulb; kleur: string; vlak: string }> = {
  let_op: { label: "Let op", icoon: AlertTriangle, kleur: "text-kb-warn-ink", vlak: "bg-kb-warn-soft" },
  goed: { label: "Goed bezig", icoon: CheckCircle2, kleur: "text-kb-good-ink", vlak: "bg-[#e3f2e8]" },
  tip: { label: "Tip", icoon: Lightbulb, kleur: "text-kb-accent-ink", vlak: "bg-kb-accent-soft" },
};

const VOORBEELDEN = [
  "Waar gaat ons geld deze maand naartoe?",
  "Kunnen we deze maand nog uit eten?",
  "Hoe doen we het vergeleken met vorige maand?",
  "Welke abonnementen hebben we?",
  "Maak een potje voor pizza en zet Domino's erin",
  "Maak een spaardoel voor vakantie van € 1.500",
];

const wanneer = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/**
 * Korda AI may use **bold** and "- " lists; show them as such instead of the
 * raw stars and dashes. Nothing else is interpreted, so text can't inject markup.
 */
function Antwoord({ tekst }: { tekst: string }) {
  const vet = (regel: string) =>
    regel.split(/(\*\*[^*]+\*\*)/g).map((deel, i) =>
      deel.startsWith("**") && deel.endsWith("**") && deel.length > 4 ? <strong key={i}>{deel.slice(2, -2)}</strong> : deel,
    );
  const blokken: Array<{ lijst: boolean; regels: string[] }> = [];
  for (const regel of tekst.split("\n")) {
    const lijst = /^\s*[-•*]\s+/.test(regel);
    const schoon = lijst ? regel.replace(/^\s*[-•*]\s+/, "") : regel;
    const vorige = blokken[blokken.length - 1];
    if (vorige && vorige.lijst === lijst && (lijst || schoon.trim())) vorige.regels.push(schoon);
    else blokken.push({ lijst, regels: [schoon] });
  }
  return (
    <div className="space-y-2">
      {blokken.map((b, i) =>
        b.lijst ? (
          <ul key={i} className="list-disc space-y-0.5 pl-5">
            {b.regels.map((r, j) => (
              <li key={j}>{vet(r)}</li>
            ))}
          </ul>
        ) : b.regels.join("").trim() ? (
          <p key={i} className="whitespace-pre-wrap">
            {vet(b.regels.join("\n").trim())}
          </p>
        ) : null,
      )}
    </div>
  );
}

type Bericht = {
  id: string;
  rol: "jij" | "ai";
  tekst: string;
  voorstel?: KordaVoorstel;
  status?: "open" | "bezig" | "gedaan" | "geannuleerd";
  uitkomst?: string[];
};

let teller = 0;
const nieuwId = () => `b${Date.now()}-${teller++}`;

/** What Korda AI hears back about its proposal, so the next answer knows. */
function geschiedenisVan(b: Bericht) {
  if (b.rol !== "ai" || !b.voorstel?.acties.length) return { rol: b.rol, tekst: b.tekst };
  const wat = b.voorstel.acties.map((a) => a.omschrijving).join("; ");
  const hoe = b.status === "gedaan" ? "uitgevoerd" : b.status === "geannuleerd" ? "niet gedaan, geannuleerd" : "nog niet bevestigd";
  return { rol: b.rol, tekst: `${b.tekst}\n[Voorstel: ${wat}. Status: ${hoe}.]` };
}

/** The card for a proposal: what will happen, and the person decides. */
function VoorstelKaart({
  bericht,
  onBevestig,
  onAnnuleer,
}: {
  bericht: Bericht;
  onBevestig: () => void;
  onAnnuleer: () => void;
}) {
  const v = bericht.voorstel!;
  const status = bericht.status ?? "open";
  return (
    <div className="ml-9 rounded-2xl border border-kb-accent/30 bg-kb-surface p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-kb-accent-ink">
        <Wand2 className="h-3.5 w-3.5" /> {status === "gedaan" ? "Gedaan" : status === "geannuleerd" ? "Niet gedaan" : "Voorstel"}
      </p>
      {v.acties.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-sm">
          {v.acties.map((a, i) => (
            <li key={i} className="flex gap-2">
              {status === "gedaan" ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-kb-good-ink" />
              ) : (
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-kb-accent" />
              )}
              <span className={status === "geannuleerd" ? "text-kb-ink3 line-through" : ""}>{a.omschrijving}</span>
            </li>
          ))}
        </ul>
      )}
      {v.notities.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-kb-ink2">
          {v.notities.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      {bericht.uitkomst?.map((u, i) => {
        const code = u.startsWith("Uitnodigingscode: ") ? u.slice(18) : null;
        return code ? (
          <div key={i} className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-kb-bg px-3 py-2">
            <span className="font-mono text-xl font-semibold tracking-[0.25em]">{code}</span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(code);
                toast.success("Code gekopieerd");
              }}
              className="flex items-center gap-1 text-sm font-medium text-kb-accent-ink"
            >
              <Copy className="h-4 w-4" /> Kopiëren
            </button>
          </div>
        ) : (
          <p key={i} className="mt-2 text-xs text-kb-ink2">
            {u}
          </p>
        );
      })}
      {(status === "open" || status === "bezig") && v.acties.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Knop variant="rustig" onClick={onAnnuleer} disabled={status === "bezig"}>
            <X className="h-4 w-4" /> Niet doen
          </Knop>
          <Knop onClick={onBevestig} disabled={status === "bezig"}>
            {status === "bezig" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Bevestigen
          </Knop>
        </div>
      )}
    </div>
  );
}

export default function BudgetKordaAI() {
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const hhId = huishouden.household.id;
  const { data: inzichten, isLoading } = useInzichten(hhId);
  const { data: potjes = [] } = usePotjes(hhId);
  const ververs = useVerversInzichten();
  const [denkt, setDenkt] = useState(false);
  const [gesprek, setGesprek] = useState<Bericht[]>([]);
  const voerUit = useVoerKordaVoorstelUit();
  const [invoer, setInvoer] = useState("");
  const [melding, setMelding] = useState<string | null>(null);
  const formulier = useRef<HTMLFormElement>(null);
  // Follow the answer as it's written, unless you scroll yourself.
  const volg = useRef(true);

  // Seen: the floating button's dot goes away.
  useEffect(() => {
    if (!inzichten) return;
    try {
      localStorage.setItem(gezienSleutel(hhId), inzichten.created_at);
    } catch {
      // Private mode: the dot just stays.
    }
  }, [inzichten, hhId]);

  // First visit: let Korda AI take its first look.
  const gestart = useRef(false);
  useEffect(() => {
    if (isLoading || inzichten || gestart.current) return;
    gestart.current = true;
    ververs.mutate(hhId, { onSuccess: (r) => r?.overgeslagen && setMelding(r.overgeslagen) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, inzichten, hhId]);

  useEffect(() => {
    const stop = () => {
      volg.current = false;
    };
    window.addEventListener("touchmove", stop, { passive: true });
    window.addEventListener("wheel", stop, { passive: true });
    return () => {
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("wheel", stop);
    };
  }, []);

  // Keep the newest line just above the input and the bottom nav: instantly
  // (smooth scrolls on every word fought each other on iOS) and only ever down.
  useEffect(() => {
    if (!volg.current || !formulier.current || gesprek.length === 0) return;
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Hoofdmenu"].fixed');
    const navHoogte = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().height : 0;
    const zichtbaarTot = window.innerHeight - navHoogte - 12;
    const onder = formulier.current.getBoundingClientRect().bottom;
    if (onder > zichtbaarTot) window.scrollBy({ top: onder - zichtbaarTot, behavior: "auto" });
  }, [gesprek, denkt]);

  /** Update Korda AI's message `id`, adding it at the first piece of text. */
  const werkBij = (id: string, wijzig: (b: Bericht) => Bericht) =>
    setGesprek((g) => {
      const bestaand = g.find((b) => b.id === id);
      if (bestaand) return g.map((b) => (b.id === id ? wijzig(b) : b));
      return [...g, wijzig({ id, rol: "ai", tekst: "" })];
    });

  const stel = async (tekst: string) => {
    const v = tekst.trim();
    if (!v || denkt) return;
    const eerder = gesprek;
    const antwoordId = nieuwId();
    setGesprek([...eerder, { id: nieuwId(), rol: "jij", tekst: v }]);
    setInvoer("");
    setDenkt(true);
    volg.current = true;
    try {
      await vraagKordaAI(
        { householdId: hhId, vraag: v, geschiedenis: eerder.map(geschiedenisVan) },
        (stukje) => werkBij(antwoordId, (b) => ({ ...b, tekst: b.tekst + stukje })),
        (voorstel) => werkBij(antwoordId, (b) => ({ ...b, voorstel, status: voorstel.acties.length ? "open" : undefined })),
      );
    } catch (e) {
      werkBij(antwoordId, (b) => ({ ...b, tekst: `${b.tekst ? `${b.tekst}\n\n` : ""}Dat lukte even niet: ${foutTekst(e)}` }));
    } finally {
      setDenkt(false);
    }
  };

  const bevestig = async (b: Bericht) => {
    if (!b.voorstel) return;
    werkBij(b.id, (x) => ({ ...x, status: "bezig" }));
    try {
      const uitkomst = await voerUit.mutateAsync({ householdId: hhId, acties: b.voorstel.acties });
      // The card itself turns into "Gedaan"; no extra toast over the nav.
      werkBij(b.id, (x) => ({ ...x, status: "gedaan", uitkomst }));
    } catch (e) {
      werkBij(b.id, (x) => ({ ...x, status: "open" }));
      toast.error(foutTekst(e));
    }
  };

  // From a notification ("Zal ik € 50 opzij zetten?"): ask it straight away, once.
  const [params, setParams] = useSearchParams();
  const gevraagd = useRef(false);
  useEffect(() => {
    const v = params.get("vraag");
    if (!v || gevraagd.current) return;
    gevraagd.current = true;
    setParams({}, { replace: true });
    void stel(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const verstuur = (e: FormEvent) => {
    e.preventDefault();
    void stel(invoer);
  };

  const potVan = (id: string | null) => potjes.find((p) => p.id === id);
  const bezig = ververs.isPending;

  return (
    <Pagina titel="Korda AI" terug={{ naar: "/budget/overzicht", label: "Overzicht" }}>
      <div className="max-w-2xl space-y-7 pb-6">
        {/* Hello */}
        <div className="flex items-center gap-4">
          <KordaAIFiguur grootte={84} />
          <div>
            <p className="text-lg font-semibold leading-snug">Hoi {huishouden.me.display_name}, ik kijk mee.</p>
            <p className="text-sm text-kb-ink2">
              Ik lees jullie potjes en uitgaven en vertel wat opvalt. Je kunt me ook gewoon iets vragen.
            </p>
          </div>
        </div>

        <Sectie
          titel="Wat opvalt"
          aside={
            <button
              type="button"
              onClick={() =>
                ververs.mutate(hhId, {
                  onSuccess: (r) => setMelding(r?.overgeslagen ?? null),
                  onError: (e) => setMelding(foutTekst(e)),
                })
              }
              disabled={bezig}
              className="flex items-center gap-1.5 text-xs font-medium text-kb-accent-ink disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${bezig ? "animate-spin" : ""}`} /> Ververs
            </button>
          }
        >
          {bezig && !inzichten ? (
            <Kaart className="flex items-center gap-3 px-4 py-5 text-sm text-kb-ink2">
              <Loader2 className="h-4 w-4 animate-spin text-kb-accent" /> Korda AI kijkt naar jullie maand…
            </Kaart>
          ) : !inzichten ? (
            <Kaart className="px-4 py-5 text-sm text-kb-ink2">
              {melding ?? "Nog geen inzichten. Tik op Ververs om Korda AI te laten kijken."}
            </Kaart>
          ) : (
            <div className="space-y-3">
              {inzichten.items.map((i, n) => {
                const s = SOORT[i.soort] ?? SOORT.tip;
                const pot = potVan(i.pot_id);
                return (
                  <Kaart key={n} className="p-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.vlak} ${s.kleur}`}>
                      <s.icoon className="h-3.5 w-3.5" /> {s.label}
                    </span>
                    <p className="mt-2 font-semibold leading-snug">{i.titel}</p>
                    <p className="mt-1 text-sm text-kb-ink2">{i.tekst}</p>
                    {pot && (
                      <Link
                        to={`/budget/potjes/${pot.id}`}
                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-kb-accent-ink hover:underline"
                      >
                        {pot.emoji} {pot.name} <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </Kaart>
                );
              })}
              <p className="px-1 text-xs text-kb-ink3">
                Geschreven {wanneer(inzichten.created_at)}. Elke zondagavond en op de 1e van de maand komt er een nieuwe
                blik bij.
                {melding && <span className="block">{melding}</span>}
              </p>
            </div>
          )}
        </Sectie>

        <Sectie titel="Vraag Korda AI">
          <Kaart className="p-4">
            {gesprek.length === 0 ? (
              <div className="flex flex-wrap gap-2">
                {VOORBEELDEN.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => stel(v)}
                    className="rounded-full border border-kb-line-strong bg-white px-3 py-1.5 text-left text-sm text-kb-ink hover:bg-kb-sunk"
                  >
                    {v}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3" aria-live="polite">
                {gesprek.map((b) =>
                  b.rol === "jij" ? (
                    <div key={b.id} className="flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-kb-accent px-3.5 py-2 text-sm text-white">
                        {b.tekst}
                      </p>
                    </div>
                  ) : (
                    <div key={b.id} className="space-y-2">
                      {b.tekst.trim() && (
                        <div className="flex items-end gap-2">
                          <KordaAIFiguur grootte={28} zweeft={false} />
                          <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-kb-sunk px-3.5 py-2 text-sm">
                            <Antwoord tekst={b.tekst} />
                          </div>
                        </div>
                      )}
                      {b.voorstel && (
                        <VoorstelKaart
                          bericht={b}
                          onBevestig={() => bevestig(b)}
                          onAnnuleer={() => werkBij(b.id, (x) => ({ ...x, status: "geannuleerd" }))}
                        />
                      )}
                    </div>
                  ),
                )}
                {/* Thinking dots until the first word arrives. */}
                {denkt && gesprek[gesprek.length - 1]?.rol === "jij" && (
                  <div className="flex items-end gap-2">
                    <KordaAIFiguur grootte={28} zweeft={false} />
                    <p className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-kb-sunk px-3.5 py-3" aria-label="Korda AI denkt na">
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-kb-ink3"
                          style={{ animationDelay: `${d * 0.15}s` }}
                        />
                      ))}
                    </p>
                  </div>
                )}
              </div>
            )}

            <form ref={formulier} onSubmit={verstuur} className="mt-4 flex items-end gap-2">
              <textarea
                value={invoer}
                onChange={(e) => setInvoer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void stel(invoer);
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder="Vraag iets over jullie geld…"
                aria-label="Vraag aan Korda AI"
                className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-kb-line-strong bg-white px-3 py-2.5 text-base outline-none focus:border-kb-accent"
              />
              <button
                type="submit"
                disabled={!invoer.trim() || denkt}
                aria-label="Versturen"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-kb-accent text-white disabled:bg-kb-accent/40"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </form>
            <p className="mt-2 text-xs text-kb-ink3">
              Korda AI ziet de gedeelde potjes en jouw eigen kant, en kan dingen voor je regelen: jij bevestigt elke
              wijziging. Geen beleggings- of belastingadvies.
            </p>
          </Kaart>
        </Sectie>
      </div>
    </Pagina>
  );
}
