// src/features/budget/hooks/useBudgetData.ts — data for transactions, rules, fixed costs,
// goals, month close, settling up and the wish list.
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { maandGrenzen, verschuifMaand } from "../lib/budget";
import { bankFetch, streamFetch, type SyncUitkomst } from "../lib/bankApi";
import type {
  BudgetAccount,
  BudgetGoal,
  BudgetGoalEntry,
  BudgetMonth,
  BudgetMonthClose,
  BudgetRecurring,
  BudgetRule,
  BudgetScope,
  BudgetSettlement,
  BudgetWish,
  KordaInzichten,
  TxMetDelen,
  TxSoort,
} from "../types";

const num = (v: unknown) => Number(v ?? 0);

/** Most writes touch several screens' numbers; refresh everything budget-related. */
const ververs = (qc: QueryClient) =>
  qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("budget_") });

function useSchrijf<T, R = void>(fn: (p: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => ververs(qc) });
}

async function ok<T>(q: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export const normaliseerTegenpartij = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// ─── transacties ─────────────────────────────────────────────────────────────

/** All transactions the user can see in a period, with their splits and account. */
export function useTransacties(householdId: string | undefined, maand: BudgetMonth, maanden = 1) {
  const { van } = maandGrenzen(verschuifMaand(maand, -(maanden - 1)));
  const { tot } = maandGrenzen(maand);
  return useQuery({
    queryKey: ["budget_tx", householdId, van, tot],
    enabled: !!householdId,
    queryFn: async (): Promise<TxMetDelen[]> => {
      const rijen = await ok(
        supabase
          .from("budget_transactions")
          .select("*, splits:budget_tx_splits(*), account:budget_accounts(id, owner_id, provider, is_joint, name)")
          .eq("household_id", householdId!)
          .gte("booked_on", van)
          .lt("booked_on", tot)
          .order("booked_on", { ascending: false })
          .order("created_at", { ascending: false }),
      );
      return (rijen ?? []).map((t) => ({
        ...t,
        amount: num(t.amount),
        splits: (t.splits ?? []).map((s: { amount: unknown }) => ({ ...s, amount: num(s.amount) })),
      })) as TxMetDelen[];
    },
  });
}

export function useZetPotje() {
  return useSchrijf(async (p: { txId: string; potId: string | null; wisSoort?: boolean }) => {
    // Assigning a whole transaction removes any earlier split.
    await ok(supabase.from("budget_tx_splits").delete().eq("transaction_id", p.txId));
    await ok(
      supabase
        .from("budget_transactions")
        .update({
          pot_id: p.potId,
          pot_status: p.potId ? "confirmed" : "unassigned",
          // Only touch soort when there is one to clear, so this works before budget_soort.sql runs.
          ...(p.wisSoort ? { soort: null } : {}),
        })
        .eq("id", p.txId),
    );
  });
}

/** Mark as income or own transfer: no pot, no split, out of the inbox. */
export function useZetSoort() {
  return useSchrijf(async (p: { txId: string; soort: TxSoort }) => {
    await ok(supabase.from("budget_tx_splits").delete().eq("transaction_id", p.txId));
    await ok(
      supabase
        .from("budget_transactions")
        .update({ pot_id: null, soort: p.soort, pot_status: "confirmed" })
        .eq("id", p.txId),
    );
  });
}

export function useSplits() {
  return useSchrijf(
    async (p: { txId: string; householdId: string; delen: Array<{ potId: string; amount: number }>; wisSoort?: boolean }) => {
      await ok(supabase.from("budget_tx_splits").delete().eq("transaction_id", p.txId));
      await ok(
        supabase.from("budget_tx_splits").insert(
          p.delen.map((d) => ({
            transaction_id: p.txId,
            household_id: p.householdId,
            pot_id: d.potId,
            amount: d.amount,
          })),
        ),
      );
      await ok(
        supabase
          .from("budget_transactions")
          .update({ pot_id: null, pot_status: "confirmed", ...(p.wisSoort ? { soort: null } : {}) })
          .eq("id", p.txId),
      );
    },
  );
}

export function useZetNotitie() {
  return useSchrijf(async (p: { txId: string; note: string }) => {
    await ok(supabase.from("budget_transactions").update({ note: p.note.trim() || null }).eq("id", p.txId));
  });
}

export function useHandmatigeUitgave() {
  return useSchrijf(
    async (p: {
      householdId: string;
      datum: string;
      bedrag: number;
      omschrijving: string;
      potId: string | null;
      notitie: string;
    }) => {
      const id = await ok(
        supabase.rpc("budget_add_manual_tx", {
          p_household: p.householdId,
          p_booked_on: p.datum,
          p_amount: p.bedrag,
          p_counterparty: p.omschrijving,
          p_pot: p.potId,
          p_note: p.notitie,
        }),
      );
      return id as string;
    },
  );
}

export function useVerwijderHandmatig() {
  return useSchrijf(async (txId: string) => {
    await ok(supabase.rpc("budget_delete_manual_tx", { p_tx: txId }));
  });
}

// ─── regels ──────────────────────────────────────────────────────────────────

export function useRegels(householdId: string | undefined) {
  return useQuery({
    queryKey: ["budget_rules", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<BudgetRule[]> =>
      (await ok(supabase.from("budget_rules").select("*").eq("household_id", householdId!))) ?? [],
  });
}

/** Remember "this counterparty goes in that pot" — upsert on (household, counterparty). */
export function useOnthoudRegel() {
  const { user } = useAuth();
  /**
   * Saves the rule (a pot, or a kind: income / own transfer), then sorts earlier
   * unsorted payments to the same party. Returns how many.
   */
  return useSchrijf(
    async (
      p: { householdId: string; tegenpartij: string } & ({ potId: string; soort?: never } | { soort: TxSoort; potId?: never }),
    ): Promise<number> => {
    const counterparty = normaliseerTegenpartij(p.tegenpartij);
    if (!counterparty) return 0;
    await ok(
      supabase.from("budget_rules").upsert(
        {
          household_id: p.householdId,
          counterparty,
          pot_id: p.potId ?? null,
          ...(p.soort ? { soort: p.soort } : { soort: null }),
          created_by: user!.id,
        },
        { onConflict: "household_id,counterparty" },
      ),
    );

    // Kind rules are applied by the database, the same way the bank sync does.
    if (p.soort) return (await ok(supabase.rpc("budget_pas_soortregels", { p_household: p.householdId }))) ?? 0;

    // Same party, still unsorted, not split, not marked income/transfer. ilike narrows it
    // down server-side; the exact match uses the same normalising as the rule.
    const patroon = p.tegenpartij.trim().replace(/[%_\\]/g, (c) => `\\${c}`).replace(/\s+/g, "%");
    const kandidaten =
      (await ok(
        supabase
          .from("budget_transactions")
          .select("*, splits:budget_tx_splits(id)")
          .eq("household_id", p.householdId)
          .is("pot_id", null)
          .ilike("counterparty", patroon)
          .limit(1000),
      )) ?? [];
    const ids = kandidaten
      .filter(
        (t: { counterparty: string | null; soort?: string | null; splits: unknown[] }) =>
          normaliseerTegenpartij(t.counterparty) === counterparty && !t.soort && t.splits.length === 0,
      )
      .map((t: { id: string }) => t.id);
    if (ids.length) {
      await ok(
        supabase.from("budget_transactions").update({ pot_id: p.potId, pot_status: "confirmed" }).in("id", ids),
      );
    }
    return ids.length;
    },
  );
}

export function useVerwijderRegel() {
  return useSchrijf(async (id: string) => {
    await ok(supabase.from("budget_rules").delete().eq("id", id));
  });
}

// ─── vaste lasten ────────────────────────────────────────────────────────────

export function useVasteLasten(householdId: string | undefined) {
  return useQuery({
    queryKey: ["budget_recurring", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<BudgetRecurring[]> =>
      ((await ok(
        supabase.from("budget_recurring").select("*").eq("household_id", householdId!).order("day_of_month"),
      )) ?? []).map((r) => ({
        ...r,
        amount: num(r.amount),
        previous_amount: r.previous_amount === null ? null : num(r.previous_amount),
      })),
  });
}

export type VasteLastInvoer = {
  name: string;
  counterparty: string;
  amount: number;
  cadence: "maand" | "jaar";
  day_of_month: number;
  month_of_year: number | null;
  is_subscription: boolean;
  pot_id: string | null;
  scope: BudgetScope;
  source?: "handmatig" | "herkend";
};

export function useBewaarVasteLast() {
  const { user } = useAuth();
  return useSchrijf(async (p: { householdId: string; id?: string; invoer: VasteLastInvoer }) => {
    const rij = {
      ...p.invoer,
      name: p.invoer.name.trim(),
      counterparty: normaliseerTegenpartij(p.invoer.counterparty) || null,
      month_of_year: p.invoer.cadence === "jaar" ? (p.invoer.month_of_year ?? 1) : null,
      owner_id: p.invoer.scope === "personal" ? user!.id : null,
    };
    await ok(
      p.id
        ? supabase.from("budget_recurring").update(rij).eq("id", p.id)
        : supabase.from("budget_recurring").insert({ ...rij, household_id: p.householdId }),
    );
  });
}

/** Record a new price and keep the old one, so the radar can show the rise. */
export function useNieuwePrijs() {
  return useSchrijf(async (p: { last: BudgetRecurring; bedrag: number }) => {
    await ok(
      supabase
        .from("budget_recurring")
        .update({
          previous_amount: p.last.amount,
          amount: Math.round(p.bedrag * 100) / 100,
          price_changed_at: new Date().toISOString(),
        })
        .eq("id", p.last.id),
    );
  });
}

export function useMarkeerBekeken() {
  return useSchrijf(async (id: string) => {
    await ok(supabase.from("budget_recurring").update({ reviewed_at: new Date().toISOString() }).eq("id", id));
  });
}

export function useVerwijderVasteLast() {
  return useSchrijf(async (id: string) => {
    await ok(supabase.from("budget_recurring").delete().eq("id", id));
  });
}

// ─── doelen ──────────────────────────────────────────────────────────────────

export type DoelMetSaldo = BudgetGoal & { saldo: number; entries: BudgetGoalEntry[] };

export function useDoelen(householdId: string | undefined) {
  return useQuery({
    queryKey: ["budget_goals", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<DoelMetSaldo[]> => {
      const doelen = await ok(
        supabase
          .from("budget_goals")
          .select("*, entries:budget_goal_entries(*)")
          .eq("household_id", householdId!)
          .is("archived_at", null)
          .order("created_at"),
      );
      return (doelen ?? []).map((d) => {
        const entries = (d.entries ?? [])
          .map((e: BudgetGoalEntry) => ({ ...e, amount: num(e.amount) }))
          .sort((a: BudgetGoalEntry, b: BudgetGoalEntry) => b.created_at.localeCompare(a.created_at));
        return {
          ...d,
          target: num(d.target),
          entries,
          saldo: entries.reduce((s: number, e: BudgetGoalEntry) => s + e.amount, 0),
        };
      });
    },
  });
}

export type DoelInvoer = {
  name: string;
  emoji: string;
  target: number;
  deadline: string | null;
  scope: BudgetScope;
  receives_leftover: boolean;
};

export function useBewaarDoel() {
  const { user } = useAuth();
  return useSchrijf(async (p: { householdId: string; id?: string; invoer: DoelInvoer }) => {
    const rij = {
      ...p.invoer,
      name: p.invoer.name.trim(),
      owner_id: p.invoer.scope === "personal" ? user!.id : null,
    };
    // Only one goal receives the month's leftover by default.
    if (rij.receives_leftover) {
      await ok(
        supabase
          .from("budget_goals")
          .update({ receives_leftover: false })
          .eq("household_id", p.householdId)
          .neq("id", p.id ?? "00000000-0000-0000-0000-000000000000"),
      );
    }
    await ok(
      p.id
        ? supabase.from("budget_goals").update(rij).eq("id", p.id)
        : supabase.from("budget_goals").insert({ ...rij, household_id: p.householdId }),
    );
  });
}

export function useArchiveerDoel() {
  return useSchrijf(async (id: string) => {
    await ok(supabase.from("budget_goals").update({ archived_at: new Date().toISOString() }).eq("id", id));
  });
}

export function useBoekOpDoel() {
  const { user } = useAuth();
  return useSchrijf(
    async (p: {
      goalId: string;
      householdId: string;
      bedrag: number;
      kind: "storting" | "opname" | "restant";
      maand?: string;
      note?: string;
    }) => {
      await ok(
        supabase.from("budget_goal_entries").insert({
          goal_id: p.goalId,
          household_id: p.householdId,
          amount: p.kind === "opname" ? -Math.abs(p.bedrag) : Math.abs(p.bedrag),
          kind: p.kind,
          month: p.maand ?? null,
          note: p.note ?? null,
          created_by: user!.id,
        }),
      );
    },
  );
}

// ─── maandafsluiting ─────────────────────────────────────────────────────────

export function useAfsluitingen(householdId: string | undefined) {
  return useQuery({
    queryKey: ["budget_closes", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<BudgetMonthClose[]> =>
      ((await ok(supabase.from("budget_month_closes").select("*").eq("household_id", householdId!))) ?? []).map(
        (c) => ({ ...c, leftover: num(c.leftover) }),
      ),
  });
}

export function useSluitMaandAf() {
  const { user } = useAuth();
  return useSchrijf(
    async (p: { householdId: string; maand: BudgetMonth; restant: number; goalId: string | null }) => {
      const month = maandGrenzen(p.maand).van;
      await ok(
        supabase.from("budget_month_closes").insert({
          household_id: p.householdId,
          month,
          leftover: Math.round(p.restant * 100) / 100,
          goal_id: p.goalId,
          closed_by: user!.id,
        }),
      );
      if (p.goalId && p.restant > 0) {
        await ok(
          supabase.from("budget_goal_entries").insert({
            goal_id: p.goalId,
            household_id: p.householdId,
            amount: Math.round(p.restant * 100) / 100,
            kind: "restant",
            month,
            created_by: user!.id,
          }),
        );
      }
    },
  );
}

// ─── verrekenen ──────────────────────────────────────────────────────────────

export function useVerrekeningen(householdId: string | undefined) {
  return useQuery({
    queryKey: ["budget_settlements", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<BudgetSettlement[]> =>
      ((await ok(
        supabase
          .from("budget_settlements")
          .select("*")
          .eq("household_id", householdId!)
          .order("created_at", { ascending: false }),
      )) ?? []).map((s) => ({ ...s, amount: num(s.amount) })),
  });
}

/**
 * Shared-pot spending since the household began, per paying account owner.
 * Joint accounts are everyone's money and don't count towards anyone.
 */
export function useGedeeldBetaald(householdId: string | undefined) {
  return useQuery({
    queryKey: ["budget_shared_paid", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const [regels, potjes, rekeningen] = await Promise.all([
        ok(supabase.from("budget_tx_lines").select("pot_id, amount, account_id").eq("household_id", householdId!)),
        ok(supabase.from("budget_pots").select("id, scope").eq("household_id", householdId!)),
        // Not the accounts table: a partner's private account is invisible there,
        // but who paid still has to be known to settle fairly.
        ok(supabase.rpc("budget_account_owners", { p_household: householdId! })),
      ]);
      const gedeeld = new Set((potjes ?? []).filter((p) => p.scope === "shared").map((p) => p.id));
      const eigenaar = new Map(
        ((rekeningen ?? []) as Array<{ account_id: string; owner_id: string; is_joint: boolean }>)
          .filter((r) => !r.is_joint)
          .map((r) => [r.account_id, r.owner_id] as const),
      );
      const perPersoon: Record<string, number> = {};
      let totaal = 0;
      for (const r of regels ?? []) {
        if (!r.pot_id || !gedeeld.has(r.pot_id)) continue;
        const wie = eigenaar.get(r.account_id);
        if (!wie) continue; // joint account: everyone's money
        const uit = -num(r.amount);
        perPersoon[wie] = (perPersoon[wie] ?? 0) + uit;
        totaal += uit;
      }
      return { perPersoon, totaal };
    },
  });
}

export function useVerreken() {
  const { user } = useAuth();
  return useSchrijf(
    async (p: { householdId: string; van: string; naar: string; bedrag: number; note?: string }) => {
      await ok(
        supabase.from("budget_settlements").insert({
          household_id: p.householdId,
          from_user: p.van,
          to_user: p.naar,
          amount: Math.round(p.bedrag * 100) / 100,
          note: p.note ?? null,
          created_by: user!.id,
        }),
      );
    },
  );
}

export function useVerwijderVerrekening() {
  return useSchrijf(async (id: string) => {
    await ok(supabase.from("budget_settlements").delete().eq("id", id));
  });
}

export function useZetVerdeelsleutel() {
  return useSchrijf(async (p: { householdId: string; gewichten: Record<string, number> }) => {
    await ok(supabase.rpc("budget_set_split_weights", { p_household: p.householdId, p_weights: p.gewichten }));
  });
}

// ─── rekeningen ──────────────────────────────────────────────────────────────

export function useRekeningen(householdId: string | undefined) {
  return useQuery({
    queryKey: ["budget_accounts", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<BudgetAccount[]> =>
      (await ok(supabase.from("budget_accounts").select("*").eq("household_id", householdId!).order("created_at"))) ??
      [],
  });
}

export function useZetGezamenlijk() {
  return useSchrijf(async (p: { id: string; isJoint: boolean }) => {
    await ok(supabase.from("budget_accounts").update({ is_joint: p.isJoint }).eq("id", p.id));
  });
}

export function useZetZichtbaarheid() {
  return useSchrijf(async (p: { id: string; visibility: "shared" | "private" }) => {
    await ok(supabase.from("budget_accounts").update({ visibility: p.visibility }).eq("id", p.id));
  });
}

export function useHernoemRekening() {
  return useSchrijf(async (p: { id: string; naam: string }) => {
    await ok(supabase.from("budget_accounts").update({ name: p.naam }).eq("id", p.id));
  });
}

// ─── bankkoppeling (ING via Enable Banking) ──────────────────────────────────

/** Ask the server for ING's login page and go there. */
export function useKoppelBank() {
  return useMutation({
    mutationFn: async (householdId: string) => {
      const { url } = await bankFetch<{ url: string }>("start", { householdId });
      window.location.assign(url);
    },
  });
}

export function useRondKoppelingAf() {
  return useSchrijf((p: { code: string; state: string }) =>
    bankFetch<{
      rekeningen: number;
      nieuw: number;
      aangesloten?: number;
      opgehaald?: number;
      oudste?: string | null;
      diepFout?: string | null;
    }>("terug", p),
  );
}

export function useBankBijwerken() {
  return useSchrijf((p: { householdId: string; alleenOud?: boolean }) => bankFetch<SyncUitkomst>("sync", p));
}

/**
 * Ask Claude for pot suggestions on unsorted payments (server side, see
 * functions/_shared/budgetAI.js). Quick when there's nothing new: the server
 * only sends payments Claude hasn't looked at.
 */
export function useClaudeVoorstellen() {
  return useSchrijf((householdId: string) =>
    bankFetch<{ bekeken?: number; voorgesteld?: number; overgeslagen?: string }>("/api/budget/ai/voorstellen", { householdId }),
  );
}

// ─── Korda AI ────────────────────────────────────────────────────────────────

/** The household's latest insights from Korda AI (null before the first). */
export function useInzichten(householdId: string | undefined) {
  return useQuery({
    queryKey: ["budget_inzichten", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<KordaInzichten | null> => {
      const { data, error } = await supabase
        .from("budget_inzichten")
        .select("*")
        .eq("household_id", householdId!)
        .is("user_id", null)
        .order("created_at", { ascending: false })
        .limit(1);
      // Before budget_inzichten.sql has run there's simply nothing yet.
      if (error) return null;
      return (data?.[0] as KordaInzichten) ?? null;
    },
  });
}

/** Ask Korda AI for fresh insights (at most hourly; otherwise returns the latest). */
export function useVerversInzichten() {
  return useSchrijf((householdId: string) => bankFetch<KordaInzichten & { overgeslagen?: string }>("/api/budget/ai/inzichten", { householdId }));
}

export type KordaBericht = { rol: "jij" | "ai"; tekst: string };

/**
 * One question to Korda AI, streamed: `opTekst` gets each piece of the answer
 * as it's written. Nothing is stored; the conversation lives on screen.
 */
export async function vraagKordaAI(
  p: { householdId: string; vraag: string; geschiedenis: KordaBericht[] },
  opTekst: (stukje: string) => void,
): Promise<void> {
  let fout: string | null = null;
  await streamFetch("/api/budget/ai/vraag", p, (r) => {
    if (typeof r.t === "string") opTekst(r.t);
    if (typeof r.fout === "string") fout = r.fout;
  });
  if (fout) throw new Error(fout);
}

/**
 * Withdraw your own consent for an account (history stays; a co-holder's
 * consent keeps it updating). With `verwijderen`, the owner deletes the
 * account and its history, and every consent on it is closed.
 */
export function useOntkoppel() {
  return useSchrijf(async (p: { accountId: string; verwijderen?: boolean }) => {
    await bankFetch("ontkoppel", { accountId: p.accountId, verwijderen: !!p.verwijderen });
  });
}

export type MijnToegang = { account_id: string; valid_until: string | null; sync_error: string | null };

/** Your own bank consents, per account: a joint account can have one per holder. */
export function useMijnToegang(householdId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["budget_account_links", householdId, user?.id],
    enabled: !!householdId && !!user,
    queryFn: async (): Promise<Record<string, MijnToegang>> => {
      const { data, error } = await supabase
        .from("budget_account_links")
        .select("account_id, valid_until, sync_error")
        .eq("user_id", user!.id);
      // Before budget_gedeeld.sql has run the table isn't there; the account summary still works.
      if (error) return {};
      return Object.fromEntries((data ?? []).map((t) => [t.account_id, t as MijnToegang]));
    },
  });
}

// ─── spaarsaldo (buffer) ─────────────────────────────────────────────────────

export function useZetSpaarsaldo() {
  return useSchrijf(async (p: { householdId: string; saldo: number }) => {
    await ok(
      supabase
        .from("budget_households")
        .update({ savings_balance: Math.round(p.saldo * 100) / 100, savings_updated_at: new Date().toISOString() })
        .eq("id", p.householdId),
    );
  });
}

// ─── wensenlijst ─────────────────────────────────────────────────────────────

export function useWensen(householdId: string | undefined) {
  return useQuery({
    queryKey: ["budget_wishes", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<BudgetWish[]> =>
      ((await ok(
        supabase
          .from("budget_wishes")
          .select("*")
          .eq("household_id", householdId!)
          .order("created_at", { ascending: false }),
      )) ?? []).map((w) => ({ ...w, price: w.price === null ? null : num(w.price) })),
  });
}

export function useNieuweWens() {
  const { user } = useAuth();
  return useSchrijf(
    async (p: { householdId: string; naam: string; prijs: number | null; url: string; scope: BudgetScope }) => {
      await ok(
        supabase.from("budget_wishes").insert({
          household_id: p.householdId,
          owner_id: user!.id,
          name: p.naam.trim(),
          price: p.prijs,
          url: p.url.trim() || null,
          scope: p.scope,
        }),
      );
    },
  );
}

export function useBeslisWens() {
  return useSchrijf(async (p: { id: string; status: "gekocht" | "geschrapt" | "wachten" }) => {
    await ok(
      supabase
        .from("budget_wishes")
        .update({ status: p.status, decided_at: p.status === "wachten" ? null : new Date().toISOString() })
        .eq("id", p.id),
    );
  });
}

export function useVerwijderWens() {
  return useSchrijf(async (id: string) => {
    await ok(supabase.from("budget_wishes").delete().eq("id", id));
  });
}
