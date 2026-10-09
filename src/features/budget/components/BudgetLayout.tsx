// src/features/budget/components/BudgetLayout.tsx — mobile-first shell for KordaBudget
import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ArrowLeftRight, Eye, EyeOff, Home, Loader2, Menu, PiggyBank, Target } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useMijnHuishoudens, type Huishouden } from "../hooks/useBudget";
import { useBankBijwerken, useRekeningen } from "../hooks/useBudgetData";
import { useHoudPushBij } from "../lib/meldingen";
import { useEigenDocument } from "../lib/eigenDocument";
import { BedragProvider, useBedragen } from "./Bedrag";
import { BudgetOnboarding } from "./BudgetOnboarding";
import { HuishoudenKiezer } from "./HuishoudenKiezer";
import { IcoonKnop } from "./ui";

const NAV = [
  { to: "/budget/overzicht", label: "Overzicht", icon: Home },
  { to: "/budget/potjes", label: "Potjes", icon: PiggyBank },
  { to: "/budget/transacties", label: "Transacties", icon: ArrowLeftRight },
  { to: "/budget/doelen", label: "Doelen", icon: Target },
  { to: "/budget/meer", label: "Meer", icon: Menu },
] as const;

export type BudgetOutletContext = {
  /** The household currently shown. */
  huishouden: Huishouden;
  huishoudens: Huishouden[];
  kies: (householdId: string) => void;
};

const PAPIER = "#f4f3ee";

/** Which household is open, remembered per user on this device. */
function useActiefHuishouden(huishoudens: Huishouden[] | undefined) {
  const { user } = useAuth();
  const sleutel = `kb-actief:${user?.id}`;
  const [gekozen, setGekozen] = useState<string | null>(() => {
    try {
      return localStorage.getItem(sleutel);
    } catch {
      return null;
    }
  });
  const kies = useCallback(
    (id: string) => {
      setGekozen(id);
      try {
        localStorage.setItem(sleutel, id);
      } catch {
        // Not persisted in private mode; the choice still holds for this session.
      }
    },
    [sleutel],
  );
  // A deleted or left household falls back to the first one still there.
  const actief =
    huishoudens?.find((h) => h.household.id === gekozen) ?? huishoudens?.[0] ?? null;
  return { actief, kies };
}

/**
 * Fetch new bank transactions when the app opens and whenever it comes back to
 * the foreground (switching back from the ING app, unlocking the phone). The
 * server skips accounts synced in the last few minutes, so this stays cheap.
 */
function AutoBijwerken({ householdId }: { householdId: string }) {
  useHoudPushBij();
  const { data: rekeningen } = useRekeningen(householdId);
  const { mutate } = useBankBijwerken();
  const gekoppeld = !!rekeningen?.some((r) => r.provider === "enable_banking" && r.link_id);
  useEffect(() => {
    if (!gekoppeld) return;
    let laatste = 0;
    const werkBij = () => {
      if (document.visibilityState !== "visible" || Date.now() - laatste < 60_000) return;
      laatste = Date.now();
      mutate({ householdId, alleenOud: true });
    };
    werkBij();
    document.addEventListener("visibilitychange", werkBij);
    window.addEventListener("focus", werkBij);
    return () => {
      document.removeEventListener("visibilitychange", werkBij);
      window.removeEventListener("focus", werkBij);
    };
  }, [gekoppeld, householdId, mutate]);
  return null;
}

function OogKnop() {
  const { verborgen, wissel } = useBedragen();
  return (
    <IcoonKnop
      onClick={wissel}
      aria-pressed={verborgen}
      aria-label={verborgen ? "Bedragen tonen" : "Bedragen verbergen"}
      title={verborgen ? "Bedragen tonen" : "Bedragen verbergen"}
    >
      {verborgen ? <EyeOff className="h-[1.15rem] w-[1.15rem]" /> : <Eye className="h-[1.15rem] w-[1.15rem]" />}
    </IcoonKnop>
  );
}

/**
 * Each page is its own download (App.tsx loads them lazily). Fetch all of
 * KordaBudget's pages once the app is idle, so switching tabs never waits on a
 * download and never shows the blank loading frame.
 */
function useLaadPaginasVooruit() {
  useEffect(() => {
    const laad = () =>
      void Promise.all([
      import("../../../pages/budget/BudgetBankTerug"),
      import("../../../pages/budget/BudgetDoelen"),
      import("../../../pages/budget/BudgetHuishoudens"),
      import("../../../pages/budget/BudgetJuridisch"),
      import("../../../pages/budget/BudgetMeer"),
      import("../../../pages/budget/BudgetOverzicht"),
      import("../../../pages/budget/BudgetPotDetail"),
      import("../../../pages/budget/BudgetPotjes"),
      import("../../../pages/budget/BudgetRekeningen"),
      import("../../../pages/budget/BudgetSnelIndelen"),
      import("../../../pages/budget/BudgetTransacties"),
      import("../../../pages/budget/BudgetVasteLasten"),
      import("../../../pages/budget/BudgetVerrekenen"),
      import("../../../pages/budget/BudgetWeek"),
      ]).catch(() => {
        // Offline or a stale deploy: the page loads on demand instead.
      });
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(laad);
    else window.setTimeout(laad, 800);
  }, []);
}

export default function BudgetLayout() {
  useEigenDocument();
  useLaadPaginasVooruit();
  const { data: huishoudens, isLoading, error } = useMijnHuishoudens();
  const { actief, kies } = useActiefHuishouden(huishoudens);

  // The rest of Korda is dark; this app is light, so paint the page behind it too.
  // The server already sends KordaBudget's name, icon and manifest for /budget
  // pages (functions/budget/_middleware.js); this covers arriving from another
  // Korda app without a page load, and puts the tracker's back on the way out.
  useEffect(() => {
    const vorige = document.body.style.background;
    document.body.style.background = PAPIER;
    const wissels: Array<[string, string, string]> = [
      ['link[rel="manifest"]', "href", "/budget-manifest.json"],
      ['link[rel="apple-touch-icon"]', "href", "/budget-icon-180.png"],
      ['meta[name="apple-mobile-web-app-title"]', "content", "KordaBudget"],
      ['meta[name="theme-color"]', "content", PAPIER],
    ];
    const oud = wissels.map(([sel, attr, nieuw]) => {
      const el = document.querySelector(sel);
      const waarde = el?.getAttribute(attr) ?? null;
      el?.setAttribute(attr, nieuw);
      return { el, attr, waarde };
    });
    const oudeTitel = document.title;
    document.title = "KordaBudget";
    return () => {
      document.body.style.background = vorige;
      for (const { el, attr, waarde } of oud) if (el && waarde) el.setAttribute(attr, waarde);
      document.title = oudeTitel;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="kb-root flex min-h-screen items-center justify-center bg-kb-bg">
        <Loader2 className="h-5 w-5 animate-spin text-kb-ink3" aria-label="Laden" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="kb-root flex min-h-screen items-center justify-center bg-kb-bg px-6 text-center">
        <div>
          <p className="text-sm font-medium text-kb-ink">Kon je huishoudens niet laden.</p>
          <p className="mt-1 text-xs text-kb-ink2">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  if (!actief || !huishoudens) {
    return (
      <div className="kb-root min-h-screen bg-kb-bg text-kb-ink">
        <BudgetOnboarding onKlaar={kies} />
      </div>
    );
  }

  const context: BudgetOutletContext = { huishouden: actief, huishoudens, kies };

  return (
    <BedragProvider>
      <AutoBijwerken householdId={actief.household.id} />
      <div className="kb-root min-h-screen bg-kb-bg text-kb-ink antialiased md:flex">
        {/* Desktop: left rail with the household switcher on top. */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-kb-line bg-kb-surface px-3 py-5 md:flex">
          <p className="px-3 text-sm font-semibold tracking-tight">
            Korda<span className="text-kb-accent">Budget</span>
          </p>
          <div className="mt-5">
            <HuishoudenKiezer huishoudens={huishoudens} actief={actief} onKies={kies} />
          </div>
          <nav className="mt-4 flex flex-col gap-0.5" aria-label="Hoofdmenu">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-kb-accent-soft font-medium text-kb-accent-ink"
                      : "text-kb-ink2 hover:bg-kb-sunk hover:text-kb-ink"
                  }`
                }
              >
                <item.icon className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.75} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex items-center justify-between px-1">
            <span className="px-2 text-xs text-kb-ink3">Bedragen</span>
            <OogKnop />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Mobile: household + privacy toggle, always in reach. */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-kb-line/70 bg-kb-bg/90 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur md:hidden">
            <HuishoudenKiezer huishoudens={huishoudens} actief={actief} onKies={kies} compact />
            <OogKnop />
          </header>

          <main className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-12">
            {/* Remount per household so no page shows the previous one's data. */}
            <Outlet key={actief.household.id} context={context} />
          </main>
        </div>

        <nav
          aria-label="Hoofdmenu"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-kb-line bg-kb-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          <ul className="grid grid-cols-5">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `group flex min-h-[3.75rem] flex-col items-center justify-center gap-1 text-[0.68rem] ${
                      isActive ? "font-semibold text-kb-accent-ink" : "text-kb-ink2"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                          isActive ? "bg-kb-accent-soft" : ""
                        }`}
                      >
                        <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.1 : 1.75} />
                      </span>
                      {item.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </BedragProvider>
  );
}
