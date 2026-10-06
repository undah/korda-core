// src/features/budget/components/BudgetLayout.tsx — mobile-first shell for KordaBudget
import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Home, PiggyBank, ArrowLeftRight, Target, Menu, Loader2 } from "lucide-react";
import { useMijnHuishouden, type MijnHuishouden } from "../hooks/useBudget";
import { BudgetOnboarding } from "./BudgetOnboarding";

const NAV = [
  { to: "/budget/overzicht", label: "Overzicht", icon: Home },
  { to: "/budget/potjes", label: "Potjes", icon: PiggyBank },
  { to: "/budget/transacties", label: "Transacties", icon: ArrowLeftRight },
  { to: "/budget/doelen", label: "Doelen", icon: Target },
  { to: "/budget/meer", label: "Meer", icon: Menu },
] as const;

export type BudgetOutletContext = { huishouden: NonNullable<MijnHuishouden> };

export default function BudgetLayout() {
  const { data: huishouden, isLoading, error } = useMijnHuishouden();

  // The rest of Korda is dark; this app is light, so paint the page behind it too.
  useEffect(() => {
    const vorige = document.body.style.background;
    document.body.style.background = "#f3f3ef";
    return () => {
      document.body.style.background = vorige;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="kb-root flex min-h-screen items-center justify-center bg-[#f3f3ef]">
        <Loader2 className="h-5 w-5 animate-spin text-[#8a8a85]" aria-label="Laden" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="kb-root flex min-h-screen items-center justify-center bg-[#f3f3ef] px-6 text-center">
        <div>
          <p className="text-sm font-medium text-[#1a1a19]">Kon je huishouden niet laden.</p>
          <p className="mt-1 text-xs text-[#5c5c58]">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  if (!huishouden) {
    return (
      <div className="kb-root min-h-screen bg-[#f3f3ef] text-[#1a1a19]">
        <BudgetOnboarding />
      </div>
    );
  }

  const context: BudgetOutletContext = { huishouden };

  return (
    <div className="kb-root min-h-screen bg-[#f3f3ef] text-[#1a1a19] md:flex">
      {/* Desktop: left rail. Mobile: bottom bar. Same five destinations. */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-[#e4e4df] bg-[#fcfcfb] px-3 py-6 md:flex">
        <div className="px-3">
          <p className="text-sm font-semibold tracking-tight">KordaBudget</p>
          <p className="mt-0.5 truncate text-xs text-[#5c5c58]">{huishouden.household.name}</p>
        </div>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Hoofdmenu">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-[#e3eafb] font-medium text-[#1d46b0]"
                    : "text-[#5c5c58] hover:bg-[#f0f0ec] hover:text-[#1a1a19]"
                }`
              }
            >
              <item.icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-10">
        <Outlet context={context} />
      </main>

      <nav
        aria-label="Hoofdmenu"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e4e4df] bg-[#fcfcfb]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-[3.5rem] flex-col items-center justify-center gap-1 text-[0.68rem] ${
                    isActive ? "font-semibold text-[#1d46b0]" : "text-[#6b6b66]"
                  }`
                }
              >
                <item.icon className="h-5 w-5" strokeWidth={1.75} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
