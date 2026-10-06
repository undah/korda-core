// src/pages/budget/BudgetMeer.tsx — household, invite, accounts, sign out
import { useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { Bell, CalendarClock, ChevronRight, Copy, Handshake, Home, Landmark, LogOut, Share2, Smartphone, UserPlus, Users } from "lucide-react";
import { meldingenAan, meldingenOndersteund, useInstalleren, zetMeldingen } from "@/features/budget/lib/meldingen";
import { useAuth } from "@/auth/AuthProvider";
import type { BudgetOutletContext } from "@/features/budget/components/BudgetLayout";
import { Kaart, Knop, Pagina, Veld, foutTekst } from "@/features/budget/components/ui";
import {
  useMaakUitnodiging,
  useOpenUitnodiging,
  useWijzigWeergavenaam,
} from "@/features/budget/hooks/useBudget";

const datum = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long" }).format(new Date(iso));

export default function BudgetMeer() {
  const { huishouden, huishoudens } = useOutletContext<BudgetOutletContext>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const hhId = huishouden.household.id;
  const { data: uitnodiging } = useOpenUitnodiging(hhId);
  const maakUitnodiging = useMaakUitnodiging();
  const wijzigNaam = useWijzigWeergavenaam();
  const [naam, setNaam] = useState(huishouden.me.display_name);

  const deel = async (code: string) => {
    const tekst = `Doe mee met ons budget in KordaBudget. Log in op ${window.location.origin}/budget en vul deze code in: ${code}`;
    try {
      if (navigator.share) await navigator.share({ text: tekst });
      else {
        await navigator.clipboard.writeText(code);
        toast.success("Code gekopieerd");
      }
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  };

  return (
    <Pagina titel="Meer">
      <div className="max-w-2xl space-y-6">
        <nav className="divide-y divide-kb-line overflow-hidden rounded-2xl border border-kb-line bg-kb-surface" aria-label="Meer">
          {[
            { to: "/budget/rekeningen", icon: Landmark, titel: "Rekeningen", sub: "ING koppelen, gedeeld of privé" },
            { to: "/budget/vaste-lasten", icon: CalendarClock, titel: "Vaste lasten", sub: "Wat terugkomt, abonnementen-radar" },
            { to: "/budget/verrekenen", icon: Handshake, titel: "Verrekenen", sub: "Wie betaalde wat voor het huishouden" },
            {
              to: "/budget/huishoudens",
              icon: Home,
              titel: "Huishoudens beheren",
              sub: `${huishoudens.length === 1 ? "1 huishouden" : `${huishoudens.length} huishoudens`} · aanmaken, verwijderen, verlaten`,
            },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="flex min-h-[3.75rem] items-center gap-3 px-4 transition-colors hover:bg-kb-sunk/60">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-kb-accent-soft text-kb-accent-ink">
                <l.icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">{l.titel}</span>
                <span className="block text-xs text-kb-ink2">{l.sub}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-kb-ink3" />
            </Link>
          ))}
        </nav>

        <AppInstellingen />

        <Kaart className="p-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-kb-accent-ink" strokeWidth={1.75} />
            <h2 className="font-semibold">{huishouden.household.name}</h2>
          </div>
          <ul className="mt-4 divide-y divide-kb-line">
            {huishouden.members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-kb-accent-soft text-sm font-semibold text-kb-accent-ink">
                  {m.display_name.slice(0, 1).toUpperCase()}
                </span>
                <span className="flex-1 text-sm font-medium">
                  {m.display_name}
                  {m.user_id === user?.id && <span className="font-normal text-kb-ink2"> (jij)</span>}
                </span>
                {m.role === "owner" && <span className="text-xs text-kb-ink2">Beheerder</span>}
              </li>
            ))}
          </ul>

          {(
            <div className="mt-4 rounded-xl bg-kb-bg p-4">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-kb-accent-ink" strokeWidth={1.75} />
                <p className="text-sm font-medium">
                  {huishouden.members.length < 2 ? "Partner uitnodigen" : "Iemand uitnodigen"}
                </p>
              </div>
              {uitnodiging ? (
                <>
                  <p className="mt-3 text-center font-mono text-3xl font-semibold tracking-[0.3em]">
                    {uitnodiging.code}
                  </p>
                  <p className="mt-1 text-center text-xs text-kb-ink2">
                    Geldig tot {datum(uitnodiging.expires_at)} · één keer te gebruiken
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Knop
                      variant="rustig"
                      onClick={async () => {
                        await navigator.clipboard.writeText(uitnodiging.code);
                        toast.success("Code gekopieerd");
                      }}
                    >
                      <Copy className="h-4 w-4" /> Kopiëren
                    </Knop>
                    <Knop onClick={() => deel(uitnodiging.code)}>
                      <Share2 className="h-4 w-4" /> Delen
                    </Knop>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-kb-ink2">
                    Je partner logt in met een eigen account en vult de code in. Daarna delen jullie
                    de gedeelde potjes en rekeningen.
                  </p>
                  <Knop
                    className="mt-3 w-full"
                    disabled={maakUitnodiging.isPending}
                    onClick={() =>
                      maakUitnodiging.mutate(hhId, { onError: (e) => toast.error(foutTekst(e)) })
                    }
                  >
                    Code maken
                  </Knop>
                </>
              )}
            </div>
          )}

          <form
            className="mt-5 flex items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await wijzigNaam.mutateAsync({ householdId: hhId, userId: user!.id, naam: naam.trim() });
                toast.success("Naam bijgewerkt");
              } catch (err) {
                toast.error(foutTekst(err));
              }
            }}
          >
            <Veld
              label="Jouw naam in het huishouden"
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              maxLength={40}
              className="flex-1"
              required
            />
            <Knop
              type="submit"
              variant="rustig"
              disabled={wijzigNaam.isPending || naam.trim() === huishouden.me.display_name}
            >
              Opslaan
            </Knop>
          </form>
        </Kaart>

        <Knop
          variant="rustig"
          className="w-full"
          onClick={async () => {
            await signOut();
            navigate("/budget", { replace: true });
          }}
        >
          <LogOut className="h-4 w-4" /> Uitloggen
        </Knop>
      </div>
    </Pagina>
  );
}

/** Notifications and "install as app" are per device, so they aren't stored in the household. */
function AppInstellingen() {
  const [aan, setAan] = useState(meldingenAan);
  const { geinstalleerd, ios, kan, installeer } = useInstalleren();
  if (!meldingenOndersteund() && geinstalleerd) return null;
  return (
    <Kaart className="divide-y divide-kb-line overflow-hidden">
      {meldingenOndersteund() && (
        <label className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-kb-accent-soft text-kb-accent-ink">
            <Bell className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-medium">Meldingen op dit apparaat</span>
            <span className="block text-xs text-kb-ink2">Als een potje bijna op is, en op zondag je week.</span>
          </span>
          <input
            type="checkbox"
            checked={aan}
            onChange={async (e) => {
              const gelukt = await zetMeldingen(e.target.checked);
              setAan(gelukt);
              if (e.target.checked && !gelukt) toast.error("Meldingen zijn geblokkeerd in je browser");
            }}
            className="h-5 w-5 accent-kb-accent"
          />
        </label>
      )}
      {!geinstalleerd && (
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-kb-accent-soft text-kb-accent-ink">
            <Smartphone className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-medium">Als app op je telefoon</span>
            <span className="block text-xs text-kb-ink2">
              {kan
                ? "Eén tik, dan staat KordaBudget op je beginscherm."
                : ios
                  ? "Tik in Safari op Deel en kies Zet op beginscherm."
                  : "Open deze pagina op je telefoon en kies Toevoegen aan beginscherm."}
            </span>
          </span>
          {kan && (
            <Knop variant="zacht" className="min-h-[2.25rem] px-3" onClick={installeer}>
              Installeren
            </Knop>
          )}
        </div>
      )}
    </Kaart>
  );
}
