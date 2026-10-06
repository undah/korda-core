// src/pages/budget/BudgetVerrekenen.tsx — who paid what for the household, and who owes whom
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Handshake, Scale, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useBedragen } from "@/features/budget/components/Bedrag";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { Avatars, Kaart, Knop, Pagina, Sectie, foutTekst } from "@/features/budget/components/ui";
import {
  useGedeeldBetaald,
  useRekeningen,
  useVerreken,
  useVerrekeningen,
  useVerwijderVerrekening,
  useZetGezamenlijk,
  useZetVerdeelsleutel,
} from "@/features/budget/hooks/useBudgetData";
import { overboekingen, verrekenSaldi } from "@/features/budget/lib/inzicht";

const datum = (iso: string) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

export default function BudgetVerrekenen() {
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const hhId = huishouden.household.id;
  const { euro } = useBedragen();
  const { data: betaald } = useGedeeldBetaald(hhId);
  const { data: verrekeningen = [] } = useVerrekeningen(hhId);
  const { data: rekeningen = [] } = useRekeningen(hhId);
  const verreken = useVerreken();
  const verwijder = useVerwijderVerrekening();
  const zetJoint = useZetGezamenlijk();
  const leden = huishouden.members;
  const naam = (id: string) => leden.find((l) => l.user_id === id)?.display_name ?? "Iemand";

  const saldi = useMemo(
    () => verrekenSaldi(leden, betaald?.perPersoon ?? {}, betaald?.totaal ?? 0, verrekeningen),
    [leden, betaald, verrekeningen],
  );
  const advies = overboekingen(saldi);
  const eigenRekeningen = rekeningen.filter((r) => r.owner_id === user?.id && r.provider !== "handmatig");

  if (leden.length < 2) {
    return (
      <Pagina titel="Verrekenen" terug={{ naar: "/budget/meer", label: "Meer" }}>
        <Kaart className="max-w-2xl px-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-kb-accent-soft text-kb-accent-ink">
            <Handshake className="h-5 w-5" />
          </div>
          <p className="mt-4 font-medium">Verrekenen doe je met z'n tweeën</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-kb-ink2">
            Nodig je partner uit. Dan houdt de app bij wie wat voor het huishouden betaalde, en wie
            wie nog iets terug moet geven.
          </p>
          <Knop className="mt-5" onClick={() => navigate("/budget/meer")}>
            <UserPlus className="h-4 w-4" /> Partner uitnodigen
          </Knop>
        </Kaart>
      </Pagina>
    );
  }

  return (
    <Pagina
      titel="Verrekenen"
      sub="Uitgaven in gedeelde potjes, betaald van ieders eigen rekening."
      terug={{ naar: "/budget/meer", label: "Meer" }}
    >
      <div className="max-w-2xl space-y-7">
        <section className="rounded-3xl bg-kb-ink px-5 py-6 text-white sm:px-7">
          {advies.length === 0 ? (
            <>
              <p className="text-sm text-white/70">Stand</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">Jullie staan quitte</p>
              <p className="mt-2 text-sm text-white/70">Niemand hoeft iets over te maken.</p>
            </>
          ) : (
            advies.map((a) => {
              const ikBetaal = a.van.userId === user?.id;
              const ikKrijg = a.naar.userId === user?.id;
              return (
                <div key={a.van.userId + a.naar.userId}>
                  <p className="text-sm text-white/70">
                    {ikBetaal
                      ? `Jij maakt over aan ${a.naar.naam}`
                      : ikKrijg
                        ? `${a.van.naam} maakt aan jou over`
                        : `${a.van.naam} maakt over aan ${a.naar.naam}`}
                  </p>
                  <p className="mt-1 text-[2.75rem] font-semibold leading-none tracking-tight">{euro(a.bedrag)}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={verreken.isPending}
                      onClick={async () => {
                        try {
                          await verreken.mutateAsync({ householdId: hhId, van: a.van.userId, naar: a.naar.userId, bedrag: a.bedrag });
                          toast.success("Verrekend — jullie staan weer quitte");
                        } catch (err) {
                          toast.error(foutTekst(err));
                        }
                      }}
                      className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-kb-ink hover:bg-white/90"
                    >
                      <Handshake className="h-4 w-4" /> Is overgemaakt
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <Sectie titel="Wie betaalde wat" aside={<span className="text-xs text-kb-ink2">totaal {euro(betaald?.totaal ?? 0)}</span>}>
          <Kaart className="divide-y divide-kb-line overflow-hidden">
            {saldi.map((s) => (
              <div key={s.userId} className="flex items-center gap-3 px-4 py-3">
                <Avatars leden={leden.filter((l) => l.user_id === s.userId)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {s.naam}
                    {s.userId === user?.id && <span className="font-normal text-kb-ink2"> (jij)</span>}
                  </p>
                  <p className="text-xs text-kb-ink2">
                    Betaalde {euro(s.betaald)} · aandeel {euro(s.aandeel)}
                  </p>
                </div>
                <p className={`text-sm font-semibold tabular-nums ${s.saldo > 0.005 ? "text-kb-good-ink" : s.saldo < -0.005 ? "text-kb-crit-ink" : "text-kb-ink2"}`}>
                  {s.saldo > 0.005 ? "+" : s.saldo < -0.005 ? "−" : ""}
                  {euro(Math.abs(s.saldo))}
                </p>
              </div>
            ))}
          </Kaart>
          <p className="mt-2 px-1 text-xs text-kb-ink2">Plus: krijgt nog geld terug. Min: moet nog iets overmaken.</p>
        </Sectie>

        <Verdeelsleutel householdId={hhId} />

        {eigenRekeningen.length > 0 && (
          <Sectie titel="Gezamenlijke rekening">
            <Kaart className="divide-y divide-kb-line overflow-hidden">
              {eigenRekeningen.map((r) => (
                <label key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-kb-ink2">Betalingen hiervan zijn van jullie samen en tellen niet mee bij verrekenen.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={r.is_joint}
                    onChange={(e) => zetJoint.mutate({ id: r.id, isJoint: e.target.checked })}
                    className="h-5 w-5 accent-kb-accent"
                    aria-label={`${r.name} is een gezamenlijke rekening`}
                  />
                </label>
              ))}
            </Kaart>
          </Sectie>
        )}

        {verrekeningen.length > 0 && (
          <Sectie titel="Eerder verrekend">
            <Kaart className="divide-y divide-kb-line overflow-hidden">
              {verrekeningen.map((v) => (
                <div key={v.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {naam(v.from_user)} <ArrowRight className="inline h-3.5 w-3.5 text-kb-ink3" /> {naam(v.to_user)}
                    <span className="block text-xs text-kb-ink2">{datum(v.created_at)}</span>
                  </span>
                  <span className="tabular-nums">{euro(v.amount)}</span>
                  {v.created_by === user?.id && (
                    <button type="button" aria-label="Verrekening weghalen" onClick={() => verwijder.mutate(v.id)} className="rounded-lg p-1.5 text-kb-ink3 hover:bg-kb-sunk hover:text-kb-crit-ink">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </Kaart>
          </Sectie>
        )}
      </div>
    </Pagina>
  );
}

/** How shared costs are divided. Edited as percentages; stored as weights. */
function Verdeelsleutel({ householdId }: { householdId: string }) {
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const leden = huishouden.members;
  const zet = useZetVerdeelsleutel();
  const som = leden.reduce((s, l) => s + Number(l.split_weight || 1), 0);
  const [pct, setPct] = useState<Record<string, string>>({});
  useEffect(() => {
    setPct(Object.fromEntries(leden.map((l) => [l.user_id, String(Math.round((Number(l.split_weight || 1) / som) * 100))])));
  }, [leden, som]);

  const totaal = Object.values(pct).reduce((s, v) => s + (Number(v) || 0), 0);
  const gelijk = leden.every((l) => Number(l.split_weight) === Number(leden[0].split_weight));

  const bewaar = async (waarden: Record<string, number>) => {
    try {
      await zet.mutateAsync({ householdId, gewichten: waarden });
      toast.success("Verdeelsleutel bijgewerkt");
    } catch (err) {
      toast.error(foutTekst(err));
    }
  };

  return (
    <Sectie titel="Verdeelsleutel">
      <Kaart className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-kb-accent-soft text-kb-accent-ink">
            <Scale className="h-4 w-4" />
          </span>
          <p className="text-sm text-kb-ink2">
            {gelijk ? "Jullie delen de gedeelde kosten gelijk." : "Jullie delen naar verhouding, bijvoorbeeld naar inkomen."} Pas het
            aan als de een meer verdient dan de ander.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {leden.map((l) => (
            <label key={l.user_id} className="flex items-center gap-2 rounded-xl border border-kb-line-strong bg-white px-3">
              <span className="flex-1 truncate py-3 text-sm">{l.display_name}</span>
              <input
                inputMode="numeric"
                value={pct[l.user_id] ?? ""}
                onChange={(e) => setPct((p) => ({ ...p, [l.user_id]: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                className="w-12 bg-transparent py-3 text-right text-base font-medium outline-none"
                aria-label={`Aandeel ${l.display_name} in procenten`}
              />
              <span className="text-sm text-kb-ink2">%</span>
            </label>
          ))}
        </div>
        <p className={`mt-2 text-xs ${totaal === 100 ? "text-kb-ink2" : "text-kb-crit-ink"}`}>
          {totaal === 100 ? "Samen 100%" : `Samen ${totaal}% — moet 100% zijn`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Knop
            variant="zacht"
            disabled={totaal !== 100 || zet.isPending}
            onClick={() => bewaar(Object.fromEntries(Object.entries(pct).map(([k, v]) => [k, Number(v) || 1])))}
          >
            Opslaan
          </Knop>
          {!gelijk && (
            <Knop variant="rustig" onClick={() => bewaar(Object.fromEntries(leden.map((l) => [l.user_id, 1])))}>
              Gelijk verdelen
            </Knop>
          )}
        </div>
      </Kaart>
    </Sectie>
  );
}
