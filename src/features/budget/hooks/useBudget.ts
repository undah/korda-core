// src/features/budget/hooks/useBudget.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import type {
  BudgetHousehold,
  BudgetInvite,
  BudgetMember,
  BudgetMonth,
  BudgetPot,
  BudgetScope,
  BudgetTransaction,
} from "../types";
import { maakUitnodigingscode, maandGrenzen, verschuifMaand } from "../lib/budget";

// numeric columns can arrive as strings; never let "400" + 0 become "4000".
const num = (v: unknown) => Number(v ?? 0);

// ─── huishoudens ─────────────────────────────────────────────────────────────

export type Huishouden = {
  household: BudgetHousehold;
  members: BudgetMember[];
  me: BudgetMember;
  /** Created it: may delete, may not leave. */
  isMaker: boolean;
};

/** Every household the signed-in user belongs to, oldest first. */
export function useMijnHuishoudens() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["budget_households", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Huishouden[]> => {
      const { data: eigen, error: e1 } = await supabase
        .from("budget_members")
        .select("household_id")
        .eq("user_id", user!.id);
      if (e1) throw e1;
      const ids = (eigen ?? []).map((r) => r.household_id);
      if (ids.length === 0) return [];

      const [{ data: households, error: e2 }, { data: members, error: e3 }] = await Promise.all([
        supabase.from("budget_households").select("*").in("id", ids).order("created_at"),
        supabase.from("budget_members").select("*").in("household_id", ids).order("joined_at"),
      ]);
      if (e2) throw e2;
      if (e3) throw e3;
      return (households ?? []).map((household) => {
        const leden = (members ?? []).filter((m) => m.household_id === household.id);
        return {
          household,
          members: leden,
          me: leden.find((m) => m.user_id === user!.id)!,
          isMaker: household.created_by === user!.id,
        };
      });
    },
  });
}

export function useVerwijderHuishouden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (householdId: string) => {
      const { error } = await supabase.rpc("budget_delete_household", { p_household: householdId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_households"] }),
  });
}

export function useVerlaatHuishouden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (householdId: string) => {
      const { error } = await supabase.rpc("budget_leave_household", { p_household: householdId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_households"] }),
  });
}

export function useMaakHuishouden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { naam: string; jouwNaam: string }) => {
      const { data, error } = await supabase.rpc("budget_create_household", {
        p_name: p.naam,
        p_display_name: p.jouwNaam,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_households"] }),
  });
}

export function useSluitAan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { code: string; jouwNaam: string }) => {
      const { data, error } = await supabase.rpc("budget_join_household", {
        p_code: p.code,
        p_display_name: p.jouwNaam,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_households"] }),
  });
}

export function useWijzigWeergavenaam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { householdId: string; userId: string; naam: string }) => {
      const { error } = await supabase
        .from("budget_members")
        .update({ display_name: p.naam })
        .eq("household_id", p.householdId)
        .eq("user_id", p.userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_households"] }),
  });
}

// ─── uitnodigingen ───────────────────────────────────────────────────────────

/** The newest still-valid invite of the household, if any. */
export function useOpenUitnodiging(householdId: string | undefined) {
  return useQuery({
    queryKey: ["budget_invite", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<BudgetInvite | null> => {
      const { data, error } = await supabase
        .from("budget_invites")
        .select("*")
        .eq("household_id", householdId!)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMaakUitnodiging() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (householdId: string) => {
      // A clash on the unique code is astronomically rare; retry once anyway.
      for (let poging = 0; poging < 2; poging++) {
        const { data, error } = await supabase
          .from("budget_invites")
          .insert({ household_id: householdId, code: maakUitnodigingscode(), created_by: user!.id })
          .select()
          .single();
        if (!error) return data as BudgetInvite;
        if (error.code !== "23505") throw error;
      }
      throw new Error("Kon geen unieke code maken, probeer opnieuw");
    },
    onSuccess: (_d, householdId) => qc.invalidateQueries({ queryKey: ["budget_invite", householdId] }),
  });
}

// ─── potjes ──────────────────────────────────────────────────────────────────

export function usePotjes(householdId: string | undefined) {
  return useQuery({
    queryKey: ["budget_pots", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<BudgetPot[]> => {
      const { data, error } = await supabase
        .from("budget_pots")
        .select("*")
        .eq("household_id", householdId!)
        .is("archived_at", null)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, monthly_limit: num(p.monthly_limit) }));
    },
  });
}

export type PotInvoer = {
  name: string;
  emoji: string;
  monthly_limit: number;
  scope: BudgetScope;
  kind: "flexibel" | "vast";
};

export function useBewaarPotje(householdId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (p: { id?: string; invoer: PotInvoer; sortOrder?: number }) => {
      const rij = {
        ...p.invoer,
        name: p.invoer.name.trim(),
        // The table enforces: personal pot <=> it has an owner.
        owner_id: p.invoer.scope === "personal" ? user!.id : null,
      };
      const query = p.id
        ? supabase.from("budget_pots").update(rij).eq("id", p.id)
        : supabase
            .from("budget_pots")
            .insert({ ...rij, household_id: householdId!, sort_order: p.sortOrder ?? 0 });
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_pots", householdId] }),
  });
}

export function useVoegPotjesToe(householdId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rijen: Array<Omit<PotInvoer, "scope" | "kind"> & { sort_order: number; kind?: "vast" }>) => {
      const { error } = await supabase
        .from("budget_pots")
        .insert(rijen.map((r) => ({ ...r, scope: "shared", household_id: householdId! })));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_pots", householdId] }),
  });
}

/** Archive rather than delete, so past months keep their history. */
export function useArchiveerPotje(householdId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("budget_pots")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_pots", householdId] }),
  });
}

// ─── uitgaven per potje ──────────────────────────────────────────────────────

/** Money out per pot in a calendar month (pot id → euros, positive). */
export function useUitgavenPerPotje(householdId: string | undefined, maand: BudgetMonth) {
  const { van, tot } = maandGrenzen(maand);
  return useQuery({
    queryKey: ["budget_spend", householdId, van],
    enabled: !!householdId,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("budget_tx_lines") // splits count per part
        .select("pot_id, amount")
        .eq("household_id", householdId!)
        .gte("booked_on", van)
        .lt("booked_on", tot)
        .not("pot_id", "is", null);
      if (error) throw error;
      const perPot: Record<string, number> = {};
      for (const t of data ?? []) {
        // Refunds (positive) lower the spend; a pot never shows below zero.
        perPot[t.pot_id!] = (perPot[t.pot_id!] ?? 0) - num(t.amount);
      }
      for (const k of Object.keys(perPot)) perPot[k] = Math.max(0, perPot[k]);
      return perPot;
    },
  });
}

/**
 * Spend per pot for the last `aantal` months ending at `tot` (oldest first).
 * One query for the whole range; bucketed client-side.
 */
export function useUitgavenHistorie(householdId: string | undefined, tot: BudgetMonth, aantal = 6) {
  const eerste = verschuifMaand(tot, -(aantal - 1));
  const { van } = maandGrenzen(eerste);
  const { tot: einde } = maandGrenzen(tot);
  return useQuery({
    queryKey: ["budget_history", householdId, van, einde],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_tx_lines")
        .select("pot_id, amount, booked_on")
        .eq("household_id", householdId!)
        .gte("booked_on", van)
        .lt("booked_on", einde)
        .not("pot_id", "is", null);
      if (error) throw error;
      const maanden = Array.from({ length: aantal }, (_, i) => verschuifMaand(eerste, i));
      const perMaand = maanden.map((maand) => ({ maand, perPot: {} as Record<string, number> }));
      for (const t of data ?? []) {
        const [j, m] = t.booked_on.split("-").map(Number);
        const rij = perMaand.find((r) => r.maand.year === j && r.maand.month === m);
        if (!rij) continue;
        rij.perPot[t.pot_id!] = (rij.perPot[t.pot_id!] ?? 0) - num(t.amount);
      }
      for (const r of perMaand)
        for (const k of Object.keys(r.perPot)) r.perPot[k] = Math.max(0, r.perPot[k]);
      return perMaand;
    },
  });
}

/**
 * What landed in one pot during a month, newest first. Reads lines, so a split
 * transaction shows here with only the part that belongs to this pot.
 */
export function usePotTransacties(potId: string | undefined, maand: BudgetMonth) {
  const { van, tot } = maandGrenzen(maand);
  return useQuery({
    queryKey: ["budget_pot_tx", potId, van],
    enabled: !!potId,
    queryFn: async (): Promise<BudgetTransaction[]> => {
      const { data: regels, error } = await supabase
        .from("budget_tx_lines")
        .select("transaction_id, amount")
        .eq("pot_id", potId!)
        .gte("booked_on", van)
        .lt("booked_on", tot);
      if (error) throw error;
      if (!regels?.length) return [];
      const { data: txs, error: e2 } = await supabase
        .from("budget_transactions")
        .select("*")
        .in("id", [...new Set(regels.map((r) => r.transaction_id))])
        .order("booked_on", { ascending: false });
      if (e2) throw e2;
      const deel = new Map<string, number>();
      for (const r of regels) deel.set(r.transaction_id, (deel.get(r.transaction_id) ?? 0) + num(r.amount));
      return (txs ?? []).map((t) => ({ ...t, amount: deel.get(t.id) ?? num(t.amount) }));
    },
  });
}

export function useHernoemHuishouden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { householdId: string; naam: string }) => {
      const { error } = await supabase
        .from("budget_households")
        .update({ name: p.naam.trim() })
        .eq("id", p.householdId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_households"] }),
  });
}
