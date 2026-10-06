// src/features/budget/components/PotMeter.tsx — one pot: what's spent against its monthly limit
import { AlertOctagon, AlertTriangle } from "lucide-react";
import { formatEuro, formatEuroRond, potStatus, type PotStatus } from "../lib/budget";
import type { BudgetPot } from "../types";

// Meter fill carries severity; the track is a lighter step of the same hue so the
// state reads across the whole bar. Warning/critical are the fixed status colours
// and always travel with an icon and a label — never colour alone.
const KLEUR: Record<PotStatus, { vulling: string; spoor: string }> = {
  ok: { vulling: "#2a5bd7", spoor: "#e3eafb" },
  bijna: { vulling: "#fab219", spoor: "#fdf0cf" },
  over: { vulling: "#d03b3b", spoor: "#f8dcdc" },
};

export function PotMeter({
  pot,
  uitgegeven,
  tempo,
  onClick,
}: {
  pot: BudgetPot;
  uitgegeven: number;
  /** Share of the month elapsed (0..1); draws the "on pace" tick. Omit for past months. */
  tempo?: number;
  onClick?: () => void;
}) {
  const limiet = pot.monthly_limit;
  const status = potStatus(uitgegeven, limiet);
  const kleur = KLEUR[status];
  const vulling = limiet > 0 ? Math.min(1, uitgegeven / limiet) : uitgegeven > 0 ? 1 : 0;
  const over = limiet - uitgegeven;

  const inhoud = (
    <>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 text-xl leading-none">
          {pot.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[0.95rem] font-medium">
              {pot.name}
              {pot.scope === "personal" && (
                <span className="ml-2 align-middle text-[0.68rem] font-medium uppercase tracking-wide text-[#6b6b66]">
                  Persoonlijk
                </span>
              )}
            </p>
            <p className="shrink-0 text-sm tabular-nums text-[#5c5c58]">
              {formatEuro(uitgegeven)}
              <span className="text-[#8a8a85]"> / {formatEuroRond(limiet)}</span>
            </p>
          </div>

          <div
            role="meter"
            aria-label={`${pot.name}: ${formatEuro(uitgegeven)} van ${formatEuroRond(limiet)}`}
            aria-valuemin={0}
            aria-valuemax={limiet}
            aria-valuenow={Math.min(uitgegeven, limiet)}
            className="relative mt-2.5 h-2 overflow-hidden rounded-full"
            style={{ background: kleur.spoor }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${vulling * 100}%`, background: kleur.vulling }}
            />
            {tempo !== undefined && tempo > 0 && tempo < 1 && limiet > 0 && (
              <span
                aria-hidden="true"
                title="Waar je zou zitten bij gelijkmatig uitgeven"
                className="absolute top-0 h-full w-0.5 bg-[#1a1a19]/35"
                style={{ left: `${tempo * 100}%` }}
              />
            )}
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {status === "over" ? (
              <>
                <AlertOctagon className="h-3.5 w-3.5 text-[#d03b3b]" strokeWidth={2} />
                <span className="font-medium text-[#1a1a19]">
                  {formatEuro(-over)} over budget
                </span>
              </>
            ) : status === "bijna" ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-[#b07a00]" strokeWidth={2} />
                <span className="font-medium text-[#1a1a19]">Bijna op</span>
                <span className="text-[#5c5c58]">· nog {formatEuro(over)}</span>
              </>
            ) : (
              <span className="text-[#5c5c58]">Nog {formatEuro(over)}</span>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-4 py-3.5 text-left transition-colors hover:bg-[#f6f6f2] focus-visible:bg-[#f6f6f2] focus-visible:outline-none"
    >
      {inhoud}
    </button>
  ) : (
    <div className="px-4 py-3.5">{inhoud}</div>
  );
}
