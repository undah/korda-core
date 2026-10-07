// src/pages/budget/BudgetRekeningen.tsx — link ING, and per account: shared or private
import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Landmark, Link2Off, Loader2, Lock, RefreshCw, ShieldCheck, Trash2, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { Wissel } from "@/features/budget/components/Blad";
import { Kaart, Knop, Pagina, Sectie, foutTekst } from "@/features/budget/components/ui";
import {
  useBankBijwerken,
  useKoppelBank,
  useMijnToegang,
  useOntkoppel,
  useRekeningen,
  useZetGezamenlijk,
  useZetZichtbaarheid,
} from "@/features/budget/hooks/useBudgetData";
import type { MijnToegang } from "@/features/budget/hooks/useBudgetData";
import type { BudgetAccount } from "@/features/budget/types";

const datum = (iso: string) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long" }).format(new Date(iso));

function geleden(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat("nl-NL", { numeric: "auto" });
  if (min < 1) return "zojuist";
  if (min < 60) return rtf.format(-min, "minute");
  if (min < 60 * 24) return rtf.format(-Math.round(min / 60), "hour");
  return rtf.format(-Math.round(min / 1440), "day");
}

const dagenTot = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

/** NL42INGB0119028255 -> NL42 •••• 8255 */
const korteIban = (iban: string | null) => (iban ? `${iban.slice(0, 4)} •••• ${iban.slice(-4)}` : null);

export default function BudgetRekeningen() {
  const { huishouden } = useOutletContext<BudgetOutletContext>();
  const { user } = useAuth();
  const hhId = huishouden.household.id;
  const { data: rekeningen = [], isLoading } = useRekeningen(hhId);
  const koppel = useKoppelBank();
  const bijwerken = useBankBijwerken();
  const { data: mijnToegang = {} } = useMijnToegang(hhId);

  const bank = rekeningen.filter((r) => r.provider === "enable_banking");
  const eigen = bank.filter((r) => r.owner_id === user?.id);
  const vanAnderen = bank.filter((r) => r.owner_id !== user?.id);
  const naamVan = (id: string) => huishouden.members.find((m) => m.user_id === id)?.display_name ?? "Partner";

  const start = () => koppel.mutate(hhId, { onError: (e) => toast.error(foutTekst(e)) });

  const werkBij = async () => {
    try {
      const u = await bijwerken.mutateAsync({ householdId: hhId });
      if (u.fouten.length) toast.error(u.fouten[0].fout);
      else toast.success(u.nieuw ? `${u.nieuw} nieuwe transacties` : "Alles is bij");
    } catch (e) {
      toast.error(foutTekst(e));
    }
  };

  return (
    <Pagina titel="Rekeningen" terug={{ naar: "/budget/meer", label: "Meer" }}>
      <div className="max-w-2xl space-y-6">
        {!isLoading && eigen.length === 0 && (
          <Kaart className="p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-kb-accent-soft text-kb-accent-ink">
              <Landmark className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Koppel je ING-rekening</h2>
            <p className="mt-1 text-sm text-kb-ink2">
              Dan komen je uitgaven vanzelf binnen en hoef je niets over te typen. Je logt in bij ING
              en kiest daar zelf welke rekeningen KordaBudget mag lezen.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                "Alleen lezen: er kan nooit geld af",
                "Je toestemming loopt na een half jaar af, en je kunt hem altijd intrekken",
                "Nieuwe rekeningen staan op privé tot jij ze deelt",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-kb-good-ink" /> {t}
                </li>
              ))}
            </ul>
            <Knop className="mt-5 w-full" onClick={start} disabled={koppel.isPending}>
              {koppel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
              ING koppelen
            </Knop>
          </Kaart>
        )}

        {eigen.length > 0 && (
          <Sectie
            titel="Jouw rekeningen"
            aside={
              <button
                type="button"
                onClick={werkBij}
                disabled={bijwerken.isPending}
                className="flex items-center gap-1.5 text-sm font-medium text-kb-accent-ink disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${bijwerken.isPending ? "animate-spin" : ""}`} /> Bijwerken
              </button>
            }
          >
            <div className="space-y-3">
              {eigen.map((r) => (
                <EigenRekening
                  key={r.id}
                  rekening={r}
                  toegang={mijnToegang[r.id]}
                  heeftPartner={huishouden.members.length > 1}
                  onOpnieuw={start}
                />
              ))}
            </div>
            <Knop variant="rustig" className="mt-3 w-full" onClick={start} disabled={koppel.isPending}>
              {koppel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
              Nog een rekening koppelen
            </Knop>
          </Sectie>
        )}

        {vanAnderen.length > 0 && (
          <Sectie titel="Gedeeld door anderen">
            <div className="space-y-3">
              {vanAnderen.map((r) => (
                <RekeningVanAnder
                  key={r.id}
                  rekening={r}
                  naam={naamVan(r.owner_id)}
                  toegang={mijnToegang[r.id]}
                  onKoppel={start}
                  bezig={koppel.isPending}
                />
              ))}
            </div>
          </Sectie>
        )}

        <p className="px-1 text-xs text-kb-ink2">
          De koppeling loopt via Enable Banking, een erkende dienst voor het lezen van
          bankgegevens. Lees hoe we met je gegevens omgaan in de{" "}
          <Link to="/budget/privacy" className="underline">
            privacyverklaring
          </Link>
          .
        </p>
      </div>
    </Pagina>
  );
}

/**
 * Someone else's account you can see. If it's joint, you can link it with your
 * own ING login too, so it's current for you without waiting on their consent.
 */
function RekeningVanAnder({
  rekening: r,
  naam,
  toegang,
  onKoppel,
  bezig,
}: {
  rekening: BudgetAccount;
  naam: string;
  toegang: MijnToegang | undefined;
  onKoppel: () => void;
  bezig: boolean;
}) {
  const ontkoppel = useOntkoppel();
  const verloopt = toegang?.valid_until ? dagenTot(toegang.valid_until) : null;
  return (
    <Kaart className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-kb-sunk text-kb-ink2">
          <Users className="h-[1.1rem] w-[1.1rem]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{r.name}</p>
          <p className="text-xs text-kb-ink2">
            {[`Van ${naam}`, r.is_joint ? "gezamenlijk" : null, r.last_synced_at ? `bijgewerkt ${geleden(r.last_synced_at)}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      {toegang ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-kb-ink2">
          {toegang.sync_error || (verloopt !== null && verloopt <= 14) ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-kb-warn-ink" />
              <span className="flex-1 text-kb-warn-ink">
                {toegang.sync_error ?? `Jouw toestemming verloopt over ${verloopt} ${verloopt === 1 ? "dag" : "dagen"}`}
              </span>
              <button type="button" onClick={onKoppel} className="font-medium text-kb-warn-ink underline">
                Opnieuw koppelen
              </button>
            </>
          ) : (
            <>
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-kb-good-ink" />
              <span className="flex-1">
                Ook met jouw ING-login gekoppeld{toegang.valid_until ? `, tot ${datum(toegang.valid_until)}` : ""}
              </span>
              <button
                type="button"
                disabled={ontkoppel.isPending}
                onClick={() =>
                  ontkoppel.mutate(
                    { accountId: r.id },
                    {
                      onSuccess: () => toast.success("Jouw toestemming is ingetrokken"),
                      onError: (e) => toast.error(foutTekst(e)),
                    },
                  )
                }
                className="font-medium hover:text-kb-crit-ink"
              >
                Intrekken
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-kb-bg p-3">
          <p className="text-sm">Staat jouw naam ook op deze rekening?</p>
          <p className="mt-0.5 text-xs text-kb-ink2">
            Koppel hem met je eigen ING-login. Dan is hij voor jou altijd actueel, ook als {naam} de app een tijd niet opent.
          </p>
          <Knop variant="zacht" className="mt-3 w-full" onClick={onKoppel} disabled={bezig}>
            {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
            Ook met mijn ING koppelen
          </Knop>
        </div>
      )}
    </Kaart>
  );
}

function EigenRekening({
  rekening: r,
  toegang,
  heeftPartner,
  onOpnieuw,
}: {
  rekening: BudgetAccount;
  toegang: MijnToegang | undefined;
  heeftPartner: boolean;
  onOpnieuw: () => void;
}) {
  const zichtbaarheid = useZetZichtbaarheid();
  const gezamenlijk = useZetGezamenlijk();
  const ontkoppel = useOntkoppel();
  const [bevestig, setBevestig] = useState<"ontkoppelen" | "verwijderen" | null>(null);

  const gekoppeld = !!r.link_id;
  // Your own consent decides how current it is for you; the account summary covers the rest.
  const geldigTot = toegang?.valid_until ?? r.consent_valid_until ?? null;
  const verloopt = geldigTot ? dagenTot(geldigTot) : null;
  const waarschuwing = !gekoppeld
    ? "Niet meer gekoppeld: er komen geen nieuwe transacties binnen"
    : toegang?.sync_error || r.sync_error
      ? (toegang?.sync_error ?? r.sync_error)
      : verloopt !== null && verloopt <= 14
        ? `Je toestemming verloopt over ${verloopt} ${verloopt === 1 ? "dag" : "dagen"}`
        : null;

  const doe = async (verwijderen: boolean) => {
    try {
      await ontkoppel.mutateAsync({ accountId: r.id, verwijderen });
      toast.success(verwijderen ? `${r.name} verwijderd` : `${r.name} ontkoppeld`);
      setBevestig(null);
    } catch (e) {
      toast.error(foutTekst(e));
    }
  };

  return (
    <Kaart className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-kb-accent-soft text-kb-accent-ink">
          <Landmark className="h-[1.1rem] w-[1.1rem]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{r.name}</p>
          <p className="text-xs text-kb-ink2">
            {[korteIban(r.iban), r.last_synced_at ? `bijgewerkt ${geleden(r.last_synced_at)}` : gekoppeld ? "nog niet bijgewerkt" : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {gekoppeld && geldigTot && !waarschuwing && (
            <p className="text-xs text-kb-ink2">Toestemming tot {datum(geldigTot)}</p>
          )}
        </div>
      </div>

      {waarschuwing && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-kb-warn-soft px-3 py-2.5 text-sm text-kb-warn-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{waarschuwing}</span>
          <button type="button" onClick={onOpnieuw} className="shrink-0 font-medium underline">
            Opnieuw koppelen
          </button>
        </div>
      )}

      {heeftPartner && (
        <div className="mt-4">
          <Wissel<"shared" | "private">
            opties={[
              { id: "private", titel: "Privé", uitleg: "Partner ziet alleen wat in gedeelde potjes valt" },
              { id: "shared", titel: "Gedeeld", uitleg: "Partner ziet alle transacties" },
            ]}
            waarde={r.visibility}
            onChange={(v) =>
              zichtbaarheid.mutate(
                { id: r.id, visibility: v },
                { onError: (e) => toast.error(foutTekst(e)) },
              )
            }
          />
          <label className="mt-3 flex items-center gap-3 rounded-xl border border-kb-line px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Gezamenlijke rekening</span>
              <span className="block text-xs text-kb-ink2">Van jullie samen; telt niet mee bij verrekenen</span>
            </span>
            <input
              type="checkbox"
              checked={r.is_joint}
              onChange={(e) =>
                gezamenlijk.mutate({ id: r.id, isJoint: e.target.checked }, { onError: (err) => toast.error(foutTekst(err)) })
              }
              className="h-5 w-5 accent-kb-accent"
            />
          </label>
        </div>
      )}
      {!heeftPartner && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-kb-ink2">
          <Lock className="h-3.5 w-3.5" /> Alleen jij ziet deze rekening. Nodig je partner uit om te kiezen wat je deelt.
        </p>
      )}

      {bevestig ? (
        <div className="mt-4 rounded-xl bg-kb-sunk p-3">
          <p className="text-sm">
            {bevestig === "ontkoppelen"
              ? "Je toestemming intrekken? Wat er al staat blijft staan. Heeft je partner hem ook gekoppeld, dan blijft hij via je partner bijwerken."
              : "Rekening en al zijn transacties verwijderen? Dit kan niet ongedaan worden."}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Knop variant="rustig" onClick={() => setBevestig(null)} disabled={ontkoppel.isPending}>
              Annuleren
            </Knop>
            <Knop variant="gevaar" onClick={() => doe(bevestig === "verwijderen")} disabled={ontkoppel.isPending}>
              {ontkoppel.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {bevestig === "ontkoppelen" ? "Ontkoppelen" : "Verwijderen"}
            </Knop>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-1">
          {gekoppeld && (
            <button
              type="button"
              onClick={() => setBevestig("ontkoppelen")}
              className="flex min-h-[2.25rem] items-center gap-1.5 rounded-lg px-2 text-xs text-kb-ink2 hover:bg-kb-sunk hover:text-kb-ink"
            >
              <Link2Off className="h-3.5 w-3.5" /> Ontkoppelen
            </button>
          )}
          <button
            type="button"
            onClick={() => setBevestig("verwijderen")}
            className="flex min-h-[2.25rem] items-center gap-1.5 rounded-lg px-2 text-xs text-kb-ink2 hover:bg-kb-sunk hover:text-kb-crit-ink"
          >
            <Trash2 className="h-3.5 w-3.5" /> Verwijderen
          </button>
        </div>
      )}
    </Kaart>
  );
}
