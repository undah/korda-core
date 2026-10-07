-- supabase/budget_gedeeld.sql — one account, a consent per holder.
-- Run after budget_soort.sql. Safe to run twice.
--
-- A joint account has two holders, and each can give KordaBudget access with
-- their own ING login. Each consent is a row here. Syncing uses the consent of
-- whoever has the app open: for ING that person is "present", so the cap of 4
-- unattended reads a day doesn't apply to them.
--
-- budget_accounts.link_id / consent_valid_until stay as a summary the app
-- reads (is it linked, until when); the server keeps them in step with this.

create table if not exists public.budget_account_links (
  account_id          uuid not null references public.budget_accounts(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  link_id             uuid not null references public.budget_bank_links(id) on delete cascade,
  provider_account_id text not null,
  valid_until         timestamptz,
  sync_error          text,
  created_at          timestamptz not null default now(),
  primary key (account_id, user_id)
);

alter table public.budget_account_links enable row level security;
-- You can see your own consents (to show when they expire); writes are server-only.
drop policy if exists account_links_own on public.budget_account_links;
create policy account_links_own on public.budget_account_links for select
  using (user_id = auth.uid());
revoke all on public.budget_account_links from anon, authenticated;
grant select on public.budget_account_links to authenticated;

-- Existing links become the owner's consent.
insert into public.budget_account_links (account_id, user_id, link_id, provider_account_id, valid_until)
  select id, owner_id, link_id, provider_account_id, consent_valid_until
  from public.budget_accounts
  where provider = 'enable_banking' and link_id is not null and provider_account_id is not null
on conflict (account_id, user_id) do nothing;
