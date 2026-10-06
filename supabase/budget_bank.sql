-- supabase/budget_bank.sql — phase 2: the ING link through Enable Banking.
-- Run after budget_features.sql. Safe to run twice.
--
-- A "link" is one consent at the bank: the user approved it in the ING app, and
-- Enable Banking gave us a session that can read the accounts they picked for
-- up to ~180 days. The session id is what the server uses to read those
-- accounts, so the app itself never sees this table: only the Cloudflare
-- functions do, with the service role.

create table if not exists public.budget_bank_links (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.budget_households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- Random value sent to the bank and checked on the way back, so a return URL
  -- can only finish a link the same user started.
  state        text not null unique,
  session_id   text unique,
  aspsp        text not null default 'ING',
  status       text not null default 'pending'
                 check (status in ('pending', 'active', 'expired', 'revoked', 'failed')),
  valid_until  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists budget_bank_links_user on public.budget_bank_links (user_id, household_id);

alter table public.budget_bank_links enable row level security;
-- No policies on purpose: with RLS on and no policy, the browser can't read or
-- write a single row. The service role bypasses RLS.
revoke all on public.budget_bank_links from anon, authenticated;

alter table public.budget_accounts add column if not exists link_id uuid
  references public.budget_bank_links(id) on delete set null;
alter table public.budget_accounts add column if not exists sync_error text;

-- From the app, an owner may rename an account and choose shared/private/joint.
-- Everything else (household, IBAN, bank ids) is set by the server.
revoke update on public.budget_accounts from authenticated;
grant update (name, visibility, is_joint) on public.budget_accounts to authenticated;

-- Remove a bank account and its history. Only your own, only bank accounts
-- (the manual "account" goes away with its last manual expense).
create or replace function public.budget_delete_account(p_account uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from budget_accounts
    where id = p_account and owner_id = auth.uid() and provider = 'enable_banking';
  if not found then raise exception 'Alleen je eigen bankrekeningen kun je verwijderen'; end if;
end $$;

revoke all on function public.budget_delete_account(uuid) from public, anon;
grant execute on function public.budget_delete_account(uuid) to authenticated;
