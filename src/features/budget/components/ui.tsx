// src/features/budget/components/ui.tsx — the few primitives KordaBudget's light theme needs.
// Kept local: the shared shadcn components are tuned for Korda's dark apps.
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

export function Pagina({
  titel,
  sub,
  actie,
  children,
}: {
  titel: string;
  sub?: ReactNode;
  actie?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 md:pt-10">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{titel}</h1>
          {sub && <div className="mt-1 text-sm text-[#5c5c58]">{sub}</div>}
        </div>
        {actie}
      </header>
      {children}
    </div>
  );
}

export function Kaart({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-[#e4e4df] bg-[#fcfcfb] ${className}`}>
      {children}
    </section>
  );
}

type KnopVariant = "primair" | "rustig" | "gevaar";

const knopStijl: Record<KnopVariant, string> = {
  primair: "bg-[#2a5bd7] text-white hover:bg-[#1d46b0] disabled:bg-[#9db3ea]",
  rustig: "border border-[#d9d9d3] bg-[#fcfcfb] text-[#1a1a19] hover:bg-[#f0f0ec]",
  gevaar: "border border-[#f1c4c4] bg-[#fcfcfb] text-[#b02f2f] hover:bg-[#fbeaea]",
};

export const Knop = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: KnopVariant }
>(function Knop({ variant = "primair", className = "", ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={`inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a5bd7] focus-visible:ring-offset-2 disabled:cursor-not-allowed ${knopStijl[variant]} ${className}`}
      {...rest}
    />
  );
});

export const Veld = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }
>(function Veld({ label, hint, id, className = "", ...rest }, ref) {
  const veldId = id ?? `veld-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className={className}>
      <label htmlFor={veldId} className="mb-1.5 block text-sm font-medium text-[#1a1a19]">
        {label}
      </label>
      <input
        ref={ref}
        id={veldId}
        className="h-11 w-full rounded-xl border border-[#d9d9d3] bg-white px-3 text-base text-[#1a1a19] outline-none transition-colors placeholder:text-[#a3a39d] focus:border-[#2a5bd7] focus:ring-2 focus:ring-[#2a5bd7]/20"
        {...rest}
      />
      {hint && <p className="mt-1.5 text-xs text-[#6b6b66]">{hint}</p>}
    </div>
  );
});

/** Shown in place of a feature that arrives in a later phase. */
export function Binnenkort({ titel, tekst, icon }: { titel: string; tekst: string; icon: ReactNode }) {
  return (
    <Kaart className="px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e3eafb] text-[#1d46b0]">
        {icon}
      </div>
      <p className="mt-4 font-medium">{titel}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[#5c5c58]">{tekst}</p>
    </Kaart>
  );
}

export function foutTekst(e: unknown): string {
  const bericht = (e as { message?: string })?.message ?? "Er ging iets mis";
  // Messages raised in our own SQL functions are already written for people.
  return bericht.replace(/^.*?ERROR:\s*/i, "");
}
