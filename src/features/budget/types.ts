// src/features/budget/types.ts — mirrors supabase/budget_schema.sql

export type BudgetScope = "shared" | "personal";

export interface BudgetHousehold {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  savings_balance: number | null;
  savings_updated_at: string | null;
}

export interface BudgetMember {
  household_id: string;
  user_id: string;
  display_name: string;
  role: "owner" | "member";
  /** Share in shared costs = weight / sum of weights. */
  split_weight: number;
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

/** Needs, wants, or saving and paying off debt: the 50/30/20 split. */
export type PotGroep = "nodig" | "wil" | "sparen";

export interface BudgetPot {
  id: string;
  household_id: string;
  name: string;
  emoji: string;
  monthly_limit: number;
  scope: BudgetScope;
  /** "vast": reserved money (rent, subscriptions) — no pace forecast, not in safe-to-spend. */
  kind: "flexibel" | "vast";
  /** 50/30/20 group. Absent before budget_groep.sql has run, null until chosen. */
  groep?: PotGroep | null;
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
  note: string | null;
  /** Income or a transfer between own accounts: not spending, no pot. */
  soort?: TxSoort | null;
}

export type TxSoort = "inkomen" | "overboeking";

export interface BudgetAccount {
  id: string;
  household_id: string;
  owner_id: string;
  name: string;
  iban: string | null;
  visibility: "shared" | "private";
  provider: string;
  is_joint: boolean;
  provider_account_id?: string | null;
  link_id?: string | null;
  consent_valid_until?: string | null;
  last_synced_at?: string | null;
  sync_error?: string | null;
  created_at?: string;
}

export interface BudgetSplit {
  id: string;
  transaction_id: string;
  household_id: string;
  pot_id: string | null;
  amount: number;
}

/** A transaction with its splits and account, as the transactions screen needs it. */
export interface TxMetDelen extends BudgetTransaction {
  splits: BudgetSplit[];
  account: Pick<BudgetAccount, "id" | "owner_id" | "provider" | "is_joint" | "name"> | null;
}

export interface BudgetRule {
  id: string;
  household_id: string;
  counterparty: string;
  /** A pot (suggested, you confirm) or a kind (applied directly); never both. */
  pot_id: string | null;
  soort?: TxSoort | null;
}

export interface BudgetRecurring {
  id: string;
  household_id: string;
  name: string;
  counterparty: string | null;
  amount: number;
  previous_amount: number | null;
  price_changed_at: string | null;
  cadence: "maand" | "jaar";
  day_of_month: number;
  month_of_year: number | null;
  is_subscription: boolean;
  pot_id: string | null;
  scope: BudgetScope;
  owner_id: string | null;
  source: "handmatig" | "herkend";
  reviewed_at: string | null;
  created_at: string;
}

export interface BudgetGoal {
  id: string;
  household_id: string;
  name: string;
  emoji: string;
  target: number;
  deadline: string | null;
  scope: BudgetScope;
  owner_id: string | null;
  receives_leftover: boolean;
  archived_at: string | null;
  created_at: string;
}

export interface BudgetGoalEntry {
  id: string;
  goal_id: string;
  household_id: string;
  amount: number;
  kind: "storting" | "opname" | "restant";
  month: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface BudgetMonthClose {
  household_id: string;
  month: string;
  leftover: number;
  goal_id: string | null;
  closed_by: string;
  closed_at: string;
}

export interface BudgetSettlement {
  id: string;
  household_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface BudgetWish {
  id: string;
  household_id: string;
  owner_id: string;
  scope: BudgetScope;
  name: string;
  price: number | null;
  url: string | null;
  wait_until: string;
  status: "wachten" | "gekocht" | "geschrapt";
  decided_at: string | null;
  created_at: string;
}

/** A calendar month, e.g. { year: 2026, month: 10 } for October 2026 (1-based). */
export interface BudgetMonth {
  year: number;
  month: number;
}
