// src/features/budget/types.ts — mirrors supabase/budget_schema.sql

export type BudgetScope = "shared" | "personal";

export interface BudgetHousehold {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface BudgetMember {
  household_id: string;
  user_id: string;
  display_name: string;
  role: "owner" | "member";
  joined_at: string;
}

export interface BudgetInvite {
  id: string;
  household_id: string;
  code: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
}

export interface BudgetPot {
  id: string;
  household_id: string;
  name: string;
  emoji: string;
  monthly_limit: number;
  scope: BudgetScope;
  owner_id: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export interface BudgetTransaction {
  id: string;
  account_id: string;
  household_id: string;
  booked_on: string;
  amount: number;
  currency: string;
  counterparty: string | null;
  description: string | null;
  pot_id: string | null;
  pot_status: "unassigned" | "suggested" | "confirmed";
}

/** A calendar month, e.g. { year: 2026, month: 10 } for October 2026 (1-based). */
export interface BudgetMonth {
  year: number;
  month: number;
}
