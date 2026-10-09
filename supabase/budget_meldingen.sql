-- supabase/budget_meldingen.sql — which notifications each person wants.
-- Run after budget_inzichten.sql. Safe to run twice.
--
-- Per person, not per device: turning "Grote uitgave" off holds on every
-- phone. `uit` lists the types turned off (see src/features/budget/lib/meldingTypen.ts);
-- everything else is on.
create table if not exists public.budget_melding_voorkeuren (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  uit        text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.budget_melding_voorkeuren enable row level security;
drop policy if exists melding_voorkeuren_eigen on public.budget_melding_voorkeuren;
create policy melding_voorkeuren_eigen on public.budget_melding_voorkeuren for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.budget_melding_voorkeuren from anon, authenticated;
grant select, insert, update on public.budget_melding_voorkeuren to authenticated;
