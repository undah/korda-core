// src/features/budget/components/MaandGrafiek.tsx — spend per month against the pot's limit
import { useState } from "react";
import { korteMaand, maandNaam, potStatus } from "../lib/budget";
import type { BudgetMonth } from "../types";
import { useBedragen } from "./Bedrag";

type Punt = { maand: BudgetMonth; bedrag: number };

/**
 * One series, so no legend box: the section title names it. Bars are thin with a
 * rounded data end; the limit is a dashed reference line, labelled once. A bar
 * over the limit switches to the critical step *and* gets a "!" label, so the
 * state never rests on colour alone. Every bar is focusable and shows its value.
 */
export function MaandGrafiek({ punten, limiet }: { punten: Punt[]; limiet: number }) {
  const { euro, euroRond } = useBedragen();
  const [actief, setActief] = useState<number | null>(null);
  const max = Math.max(limiet * 1.15, ...punten.map((p) => p.bedrag), 1);
  const hoogte = 140;
  const limietY = (limiet / max) * hoogte;
  const leeg = punten.every((p) => p.bedrag === 0);

  return (
    <figure>
      <div className="relative" style={{ height: hoogte + 4 }} onMouseLeave={() => setActief(null)}>
        {/* recessive baseline */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-kb-line-strong" />
        {limiet > 0 && (
          <div
            className="absolute inset-x-0 border-t border-dashed border-kb-ink3/70"
            style={{ bottom: limietY }}
          >
            <span className="absolute -top-[1.15rem] right-0 bg-kb-surface pl-1.5 text-[0.68rem] text-kb-ink2">
              limiet {euroRond(limiet)}
            </span>
          </div>
        )}

        <div className="absolute inset-0 flex items-end justify-around gap-2 px-1">
          {punten.map((p, i) => {
            const status = potStatus(p.bedrag, limiet);
            const h = Math.max(p.bedrag > 0 ? 3 : 0, (p.bedrag / max) * hoogte);
            const isLaatste = i === punten.length - 1;
            return (
              <button
                key={`${p.maand.year}-${p.maand.month}`}
                type="button"
                onMouseEnter={() => setActief(i)}
                onFocus={() => setActief(i)}
                onBlur={() => setActief(null)}
                onClick={() => setActief(i)}
                aria-label={`${maandNaam(p.maand)}: ${euro(p.bedrag)}${status === "over" ? ", over de limiet" : ""}`}
                // Hit target is the whole column, wider and taller than the mark.
                className="group relative flex h-full flex-1 items-end justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kb-accent"
              >
                <span
                  className={`w-full max-w-[1.75rem] rounded-t-[4px] transition-opacity ${
                    status === "over" ? "bg-kb-crit" : isLaatste ? "bg-kb-accent" : "bg-kb-accent/45"
                  } ${actief !== null && actief !== i ? "opacity-40" : ""}`}
                  style={{ height: h }}
                />
                {status === "over" && (
                  <span
                    aria-hidden="true"
                    className="absolute text-[0.7rem] font-bold text-kb-crit-ink"
                    style={{ bottom: h + 3 }}
                  >
                    !
                  </span>
                )}
                {actief === i && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-kb-ink px-2 py-1 text-xs font-medium text-white shadow-lg"
                    style={{ bottom: h + 10 }}
                  >
                    <span className="capitalize">{korteMaand(p.maand)}</span> · {euro(p.bedrag)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex justify-around gap-2 px-1">
        {punten.map((p, i) => (
          <span
            key={i}
            className={`flex-1 text-center text-[0.7rem] capitalize ${i === punten.length - 1 ? "font-semibold text-kb-ink" : "text-kb-ink2"}`}
          >
            {korteMaand(p.maand)}
          </span>
        ))}
      </div>
      {leeg && (
        <figcaption className="mt-3 text-center text-xs text-kb-ink2">
          Nog geen uitgaven om te tonen. Na het koppelen van ING vult deze grafiek zich vanzelf.
        </figcaption>
      )}
    </figure>
  );
}
