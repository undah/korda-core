// src/features/budget/components/Blad.tsx — the bottom sheet every form in KordaBudget uses
import type { ReactNode } from "react";
import { Drawer } from "vaul";
import type { BudgetPot } from "../types";

export function Blad({
  open,
  onOpenChange,
  titel,
  beschrijving,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titel: ReactNode;
  beschrijving?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-kb-ink/40" />
        <Drawer.Content className="kb-root fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[94vh] w-full max-w-lg flex-col rounded-t-3xl bg-kb-surface text-kb-ink outline-none">
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-kb-line-strong" />
          <div className="overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
            <Drawer.Title className="text-lg font-semibold tracking-tight">{titel}</Drawer.Title>
            {beschrijving ? (
              <Drawer.Description className="mt-1 text-sm text-kb-ink2">{beschrijving}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{titel}</Drawer.Description>
            )}
            <div className="mt-5">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Pots as tappable chips; `null` means "not assigned". */
export function PotKiezer({
  potjes,
  waarde,
  onKies,
  metGeen = false,
}: {
  potjes: BudgetPot[];
  waarde: string | null;
  onKies: (id: string | null) => void;
  metGeen?: boolean;
}) {
  const chip = (actief: boolean) =>
    `flex min-h-[2.5rem] items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
      actief
        ? "border-kb-accent bg-kb-accent-soft font-medium text-kb-accent-ink"
        : "border-kb-line-strong bg-white text-kb-ink hover:bg-kb-sunk"
    }`;
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {metGeen && (
        <button type="button" role="radio" aria-checked={waarde === null} onClick={() => onKies(null)} className={chip(waarde === null)}>
          Nog niet
        </button>
      )}
      {potjes.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={waarde === p.id}
          onClick={() => onKies(p.id)}
          className={chip(waarde === p.id)}
        >
          <span aria-hidden="true">{p.emoji}</span>
          {p.name}
        </button>
      ))}
    </div>
  );
}

/** Two-option toggle used for shared/personal, monthly/yearly, flexible/fixed. */
export function Wissel<T extends string>({
  opties,
  waarde,
  onChange,
}: {
  // Pass T explicitly (<Wissel<"a" | "b">>): with strict off, literal ids widen to string.
  opties: ReadonlyArray<{ id: T; titel: string; uitleg?: string }>;
  waarde: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className={`grid gap-2 ${opties.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {opties.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={waarde === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
            waarde === o.id ? "border-kb-accent bg-kb-accent-soft" : "border-kb-line-strong bg-white hover:bg-kb-sunk"
          }`}
        >
          <span className="block text-sm font-medium">{o.titel}</span>
          {o.uitleg && <span className="block text-xs text-kb-ink2">{o.uitleg}</span>}
        </button>
      ))}
    </div>
  );
}
