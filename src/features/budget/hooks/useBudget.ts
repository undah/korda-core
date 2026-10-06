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
} from "../types";
import { maakUitnodigingscode, maandGrenzen } from "../lib/budget";

// numeric columns can arrive as strings; never let "400" + 0 become "4000".
const num = (v: unknown) => Number(v ?? 0);

// ─── huishouden ──────────────────────────────────────────────────────────────

export type MijnHuishouden = {
  household: BudgetHousehold;
  members: BudgetMember[];
  me: BudgetMember;
} | null;

/** The signed-in user's household with its members, or null when they have none yet. */
export function useMijnHuishouden() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["budget_household", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MijnHuishouden> => {
      const { data: eigen, error: e1 } = await supabase
        .from("budget_members")
        .select("household_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (e1) throw e1;
      if (!eigen) return null;

      const [{ data: household, error: e2 }, { data: members, error: e3 }] = await Promise.all([
        supabase.from("budget_households").select("*").eq("id", eigen.household_id).single(),
        supabase
          .from("budget_members")
          .select("*")
          .eq("household_id", eigen.household_id)
          .order("joined_at"),
      ]);
      if (e2) throw e2;
      if (e3) throw e3;
      const me = members!.find((m) => m.user_id === user!.id)!;
      return { household: household!, members: members ?? [], me };
    },
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_household"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_household"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_household"] }),
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
    mutationFn: async (rijen: Array<Omit<PotInvoer, "scope"> & { sort_order: number }>) => {
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
        .from("budget_transactions")
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
