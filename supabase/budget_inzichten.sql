-- supabase/budget_inzichten.sql — Korda AI's insights (phase 3C).
-- Run after budget_ai.sql. Safe to run twice.
--
-- A set of 3–5 short insights per household, written by the server from facts
-- it computed itself. Household insights (user_id null) only use shared pots
-- and shared accounts, so nobody learns about a partner's private side.
create table if not exists public.budget_inzichten (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.budget_households(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  items        jsonb not null,
  created_at   timestamptz not null default now()
);
create index if not exists budget_inzichten_hh on public.budget_inzichten (household_id, created_at desc);

alter table public.budget_inzichten enable row level security;
drop policy if exists inzichten_lezen on public.budget_inzichten;
create policy inzichten_lezen on public.budget_inzichten for select
  using (budget_is_member(household_id) and (user_id is null or user_id = auth.uid()));
revoke all on public.budget_inzichten from anon, authenticated;
grant select on public.budget_inzichten to authenticated;
