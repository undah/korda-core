// src/features/budget/components/ui.tsx — the few primitives KordaBudget's light theme needs.
// Kept local: the shared shadcn components are tuned for Korda's dark apps.
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isZelfdeMaand, huidigeMaand, maandNaam, verschuifMaand } from "../lib/budget";
import type { BudgetMember, BudgetMonth } from "../types";

export function Pagina({
  titel,
  sub,
  actie,
  terug,
  boven,
  children,
}: {
  titel: ReactNode;
  sub?: ReactNode;
  actie?: ReactNode;
  /** Back link for detail screens. */
  terug?: { naar: string; label: string };
  /** Slot above the title (household switcher on mobile). */
  boven?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 md:pt-10">
      {boven}
      {terug && (
        <Link
          to={terug.naar}
          className="-ml-1 mb-3 inline-flex min-h-[2.25rem] items-center gap-1 rounded-lg pr-2 text-sm text-kb-ink2 hover:text-kb-ink"
        >
          <ChevronLeft className="h-4 w-4" /> {terug.label}
        </Link>
      )}
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-[1.65rem] font-semibold leading-tight tracking-tight">{titel}</h1>
          {sub && <div className="mt-1 text-sm text-kb-ink2">{sub}</div>}
        </div>
        {actie}
      </header>
      {children}
    </div>
  );
}

export function Sectie({
  titel,
  aside,
  children,
  className = "",
}: {
  titel: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-kb-ink2">{titel}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Kaart({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-kb-line bg-kb-surface ${className}`}>{children}</div>
  );
}

type KnopVariant = "primair" | "rustig" | "gevaar" | "zacht";

const knopStijl: Record<KnopVariant, string> = {
  primair: "bg-kb-accent text-white hover:bg-kb-accent-ink disabled:bg-kb-accent/40",
  rustig: "border border-kb-line-strong bg-kb-surface text-kb-ink hover:bg-kb-sunk",
  zacht: "bg-kb-accent-soft text-kb-accent-ink hover:bg-kb-accent-soft/70",
  gevaar: "border border-kb-crit-soft bg-kb-surface text-kb-crit-ink hover:bg-kb-crit-soft/60",
};

export const Knop = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: KnopVariant }
>(function Knop({ variant = "primair", className = "", ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={`inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kb-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kb-bg disabled:cursor-not-allowed ${knopStijl[variant]} ${className}`}
      {...rest}
    />
  );
});

/** Round icon-only button; always pass an aria-label. */
export const IcoonKnop = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function IcoonKnop({ className = "", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-kb-ink2 transition-colors hover:bg-kb-sunk hover:text-kb-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kb-accent disabled:opacity-30 ${className}`}
        {...rest}
      />
    );
  },
);

export const Veld = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }
>(function Veld({ label, hint, id, className = "", ...rest }, ref) {
  const veldId = id ?? `veld-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className={className}>
      <label htmlFor={veldId} className="mb-1.5 block text-sm font-medium text-kb-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={veldId}
        className="h-12 w-full rounded-xl border border-kb-line-strong bg-white px-3.5 text-base text-kb-ink outline-none transition-colors placeholder:text-kb-ink3 focus:border-kb-accent focus:ring-4 focus:ring-kb-accent/15"
        {...rest}
      />
      {hint && <p className="mt-1.5 text-xs text-kb-ink2">{hint}</p>}
    </div>
  );
});

export function MaandKiezer({
  maand,
  onChange,
}: {
  maand: BudgetMonth;
  onChange: (m: BudgetMonth) => void;
}) {
  const ditIsNu = isZelfdeMaand(maand, huidigeMaand());
  return (
    <div className="flex items-center gap-0.5">
      <IcoonKnop aria-label="Vorige maand" onClick={() => onChange(verschuifMaand(maand, -1))}>
        <ChevronLeft className="h-5 w-5" />
      </IcoonKnop>
      <button
        type="button"
        onClick={() => onChange(huidigeMaand())}
        disabled={ditIsNu}
        title={ditIsNu ? undefined : "Terug naar deze maand"}
        className="min-w-[8.5rem] rounded-lg px-2 py-1.5 text-center text-sm font-medium capitalize text-kb-ink enabled:hover:bg-kb-sunk"
      >
        {maandNaam(maand)}
      </button>
      <IcoonKnop
        aria-label="Volgende maand"
        onClick={() => onChange(verschuifMaand(maand, 1))}
        disabled={ditIsNu}
      >
        <ChevronRight className="h-5 w-5" />
      </IcoonKnop>
    </div>
  );
}

export function Avatars({ leden, groot = false }: { leden: BudgetMember[]; groot?: boolean }) {
  const maat = groot ? "h-9 w-9 text-sm" : "h-7 w-7 text-[0.7rem]";
  return (
    <div className="flex -space-x-2" aria-label={leden.map((l) => l.display_name).join(" en ")}>
      {leden.map((l, i) => (
        <span
          key={l.user_id}
          aria-hidden="true"
          className={`flex items-center justify-center rounded-full font-semibold ring-2 ring-kb-bg ${maat} ${
            i % 2 === 0 ? "bg-kb-accent-soft text-kb-accent-ink" : "bg-kb-warn-soft text-kb-warn-ink"
          }`}
        >
          {l.display_name.slice(0, 1).toUpperCase()}
        </span>
      ))}
    </div>
  );
}

/** Shown in place of a feature that arrives in a later phase. */
export function Binnenkort({ titel, tekst, icon }: { titel: string; tekst: string; icon: ReactNode }) {
  return (
    <Kaart className="px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-kb-accent-soft text-kb-accent-ink">
        {icon}
      </div>
      <p className="mt-4 font-medium">{titel}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-kb-ink2">{tekst}</p>
    </Kaart>
  );
}

export function foutTekst(e: unknown): string {
  const bericht = (e as { message?: string })?.message ?? "Er ging iets mis";
  // Messages raised in our own SQL functions are already written for people.
  return bericht.replace(/^.*?ERROR:\s*/i, "");
}
