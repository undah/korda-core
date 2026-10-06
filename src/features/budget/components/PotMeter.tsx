// src/features/budget/components/PotMeter.tsx — how a pot is doing, as a meter and as a tile
import { AlertOctagon, AlertTriangle, Lock, TrendingUp } from "lucide-react";
import { korteDatum, opDatum, potStatus, type PotStatus } from "../lib/budget";
import type { BudgetMonth, BudgetPot } from "../types";
import { useBedragen } from "./Bedrag";

// The fill carries severity; the track is a lighter step of the same hue so the
// state reads across the whole bar. Warning and critical are the fixed status
// steps and always travel with an icon and a label, never colour alone.
const KLEUR: Record<PotStatus, { vulling: string; spoor: string }> = {
  ok: { vulling: "bg-kb-accent", spoor: "bg-kb-accent-soft" },
  bijna: { vulling: "bg-kb-warn", spoor: "bg-kb-warn-soft" },
  over: { vulling: "bg-kb-crit", spoor: "bg-kb-crit-soft" },
};

export function Meter({
  uitgegeven,
  limiet,
  tempo,
  dik = false,
  vast = false,
  label,
}: {
  uitgegeven: number;
  limiet: number;
  /** Fixed pot: filling up is the plan, so only "over" changes the colour. */
  vast?: boolean;
  /** Share of the month elapsed (0..1); draws the even-spending marker. */
  tempo?: number;
  dik?: boolean;
  label: string;
}) {
  const status = vast ? (uitgegeven > limiet ? "over" : "ok") : potStatus(uitgegeven, limiet);
  const vulling = limiet > 0 ? Math.min(1, uitgegeven / limiet) : uitgegeven > 0 ? 1 : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limiet}
      aria-valuenow={Math.min(uitgegeven, limiet)}
      className={`relative w-full overflow-hidden rounded-full ${dik ? "h-3" : "h-1.5"} ${KLEUR[status].spoor}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${KLEUR[status].vulling}`}
        style={{ width: `${vulling * 100}%` }}
      />
      {!vast && tempo !== undefined && tempo > 0 && tempo < 1 && limiet > 0 && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-[2px] bg-kb-ink/40"
          style={{ left: `calc(${tempo * 100}% - 1px)` }}
        />
      )}
    </div>
  );
}

export type PotSignaal = {
  status: PotStatus;
  /** Day of month the pot runs out at the current pace, if before month end. */
  opDag: number | null;
};

export function potSignaal(uitgegeven: number, pot: BudgetPot, maand: BudgetMonth): PotSignaal {
  // Rent being paid isn't news: a fixed pot only signals when it goes over.
  if (pot.kind === "vast") return { status: uitgegeven > pot.monthly_limit ? "over" : "ok", opDag: null };
  const status = potStatus(uitgegeven, pot.monthly_limit);
  return { status, opDag: status === "over" ? null : opDatum(uitgegeven, pot.monthly_limit, maand) };
}

/** One line that says what matters about this pot right now, icon included. */
export function PotStatusRegel({
  pot,
  uitgegeven,
  maand,
}: {
  pot: BudgetPot;
  uitgegeven: number;
  maand: BudgetMonth;
}) {
  const { euro, euroRond } = useBedragen();
  const { status, opDag } = potSignaal(uitgegeven, pot, maand);
  const rest = pot.monthly_limit - uitgegeven;

  if (status === "over")
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-kb-crit-ink">
        <AlertOctagon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
        {euro(-rest)} over de limiet
      </p>
    );
  if (status === "bijna")
    // A pace forecast adds nothing to a pot that is already nearly empty.
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-kb-warn-ink">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
        {rest < 0.005 ? "Helemaal op" : "Bijna op"}
      </p>
    );
  if (opDag)
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-kb-warn-ink">
        <TrendingUp className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
        Leeg op {korteDatum(maand, opDag)} bij dit tempo
      </p>
    );
  if (pot.kind === "vast")
    return (
      <p className="text-xs text-kb-ink3">
        {euroRond(uitgegeven)} van {euroRond(pot.monthly_limit)} betaald
      </p>
    );
  return <p className="text-xs text-kb-ink3">van {euroRond(pot.monthly_limit)}</p>;
}

/** Overview tile: what's left is the headline, the meter is the context. */
export function PotTegel({
  pot,
  uitgegeven,
  maand,
  tempo,
  onClick,
}: {
  pot: BudgetPot;
  uitgegeven: number;
  maand: BudgetMonth;
  tempo?: number;
  onClick: () => void;
}) {
  const { euro } = useBedragen();
  const rest = pot.monthly_limit - uitgegeven;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full flex-col rounded-2xl border border-kb-line bg-kb-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-kb-line-strong hover:shadow-[0_6px_20px_-12px_rgba(23,24,28,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kb-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-kb-sunk text-lg"
        >
          {pot.emoji}
        </span>
        {pot.scope === "personal" ? (
          <span className="flex items-center gap-1 text-[0.68rem] font-medium text-kb-ink2">
            <Lock className="h-3 w-3" strokeWidth={2} /> Alleen jij
          </span>
        ) : pot.kind === "vast" ? (
          <span className="rounded-full bg-kb-sunk px-2 py-0.5 text-[0.68rem] font-medium text-kb-ink2">Vast</span>
        ) : null}
      </div>
      <p className="mt-3 truncate text-sm font-medium text-kb-ink2">{pot.name}</p>
      <p
        className={`mt-0.5 text-xl font-semibold tracking-tight ${rest < 0 ? "text-kb-crit-ink" : "text-kb-ink"}`}
      >
        {rest < 0 ? `−${euro(-rest)}` : euro(rest)}
        <span className="ml-1 text-xs font-normal text-kb-ink3">{rest < 0 ? "te veel" : "over"}</span>
      </p>
      <div className="mt-3">
        <Meter
          uitgegeven={uitgegeven}
          limiet={pot.monthly_limit}
          tempo={tempo}
          vast={pot.kind === "vast"}
          label={`${pot.name}: ${euro(uitgegeven)} uitgegeven`}
        />
      </div>
      <div className="mt-2 min-h-[1rem]">
        <PotStatusRegel pot={pot} uitgegeven={uitgegeven} maand={maand} />
      </div>
    </button>
  );
}
