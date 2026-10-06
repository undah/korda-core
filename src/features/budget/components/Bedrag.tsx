// src/features/budget/components/Bedrag.tsx — amounts that can be hidden at a glance.
// "Bedragen verbergen" is for checking your budget on the train or at the till
// without your balance being readable over your shoulder.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { formatEuro, formatEuroRond } from "../lib/budget";

const OPSLAG = "kb-bedragen-verbergen";
const VERBORGEN = "€ ••••";

type BedragContext = {
  verborgen: boolean;
  wissel: () => void;
  euro: (n: number) => string;
  euroRond: (n: number) => string;
};

const Ctx = createContext<BedragContext | null>(null);

export function BedragProvider({ children }: { children: ReactNode }) {
  const [verborgen, setVerborgen] = useState(() => {
    try {
      return localStorage.getItem(OPSLAG) === "1";
    } catch {
      return false;
    }
  });

  const wissel = useCallback(() => {
    setVerborgen((v) => {
      try {
        localStorage.setItem(OPSLAG, v ? "0" : "1");
      } catch {
        // Private mode: the toggle still works for this session.
      }
      return !v;
    });
  }, []);

  const waarde = useMemo<BedragContext>(
    () => ({
      verborgen,
      wissel,
      euro: (n) => (verborgen ? VERBORGEN : formatEuro(n)),
      euroRond: (n) => (verborgen ? VERBORGEN : formatEuroRond(n)),
    }),
    [verborgen, wissel],
  );

  return <Ctx.Provider value={waarde}>{children}</Ctx.Provider>;
}

export function useBedragen(): BedragContext {
  const ctx = useContext(Ctx);
  // Outside the app shell (landing, login) amounts are never private data.
  return ctx ?? { verborgen: false, wissel: () => {}, euro: formatEuro, euroRond: formatEuroRond };
}
