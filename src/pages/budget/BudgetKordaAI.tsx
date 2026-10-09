// src/pages/budget/BudgetKordaAI.tsx — Korda AI: insights for the household, and questions.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { AlertTriangle, ArrowUp, CheckCircle2, ChevronRight, Lightbulb, Loader2, RefreshCw } from "lucide-react";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { KordaAIFiguur, gezienSleutel } from "@/features/budget/components/KordaAI";
import { Kaart, Pagina, Sectie, foutTekst } from "@/features/budget/components/ui";
import { usePotjes } from "@/features/budget/hooks/useBudget";
import {
  useInzichten,
  useVerversInzichten,
  useVraagKordaAI,
  type KordaBericht,
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
];

const wanneer = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default function BudgetKordaAI() {
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const hhId = huishouden.household.id;
  const { data: inzichten, isLoading } = useInzichten(hhId);
  const { data: potjes = [] } = usePotjes(hhId);
  const ververs = useVerversInzichten();
  const vraag = useVraagKordaAI();
  const [gesprek, setGesprek] = useState<KordaBericht[]>([]);
  const [invoer, setInvoer] = useState("");
  const [melding, setMelding] = useState<string | null>(null);
  const einde = useRef<HTMLDivElement>(null);

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
    einde.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [gesprek.length, vraag.isPending]);

  const stel = async (tekst: string) => {
    const v = tekst.trim();
    if (!v || vraag.isPending) return;
    const eerder = gesprek;
    setGesprek([...eerder, { rol: "jij", tekst: v }]);
    setInvoer("");
    try {
      const antwoord = await vraag.mutateAsync({ householdId: hhId, vraag: v, geschiedenis: eerder });
      setGesprek((g) => [...g, { rol: "ai", tekst: antwoord }]);
    } catch (e) {
      setGesprek((g) => [...g, { rol: "ai", tekst: `Dat lukte even niet: ${foutTekst(e)}` }]);
    }
  };

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
                {gesprek.map((b, n) =>
                  b.rol === "jij" ? (
                    <div key={n} className="flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-kb-accent px-3.5 py-2 text-sm text-white">
                        {b.tekst}
                      </p>
                    </div>
                  ) : (
                    <div key={n} className="flex items-end gap-2">
                      <KordaAIFiguur grootte={28} zweeft={false} />
                      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-kb-sunk px-3.5 py-2 text-sm">
                        {b.tekst}
                      </p>
                    </div>
                  ),
                )}
                {vraag.isPending && (
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
                <div ref={einde} />
              </div>
            )}

            <form onSubmit={verstuur} className="mt-4 flex items-end gap-2">
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
                disabled={!invoer.trim() || vraag.isPending}
                aria-label="Versturen"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-kb-accent text-white disabled:bg-kb-accent/40"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </form>
            <p className="mt-2 text-xs text-kb-ink3">
              Korda AI ziet de gedeelde potjes en jouw eigen kant. Het geeft geen beleggings- of belastingadvies.
            </p>
          </Kaart>
        </Sectie>
      </div>
    </Pagina>
  );
}
