-- KordaBudget — huishoudbudget (fase 1: huishouden, leden, uitnodigingen, potjes;
-- rekeningen en transacties staan er al, zodat de privacyregels in één keer kloppen).
--
-- Uitvoeren in de Supabase SQL editor. Idempotent: opnieuw draaien kan.
--
-- Privacy in het kort:
--   * Een gebruiker zit in hoogstens één huishouden.
--   * Gedeelde potjes en rekeningen ziet het hele huishouden.
--   * Persoonlijke potjes en privé-rekeningen ziet alleen de eigenaar.
--   * Een transactie van een privé-rekening is voor de partner alleen zichtbaar
--     als hij in een gedeeld potje is ingedeeld (dan is het een huishoudenuitgave).

-- ─── tabellen ────────────────────────────────────────────────────────────────

create table if not exists public.budget_households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.budget_members (
  household_id uuid not null references public.budget_households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id),
  -- Eén huishouden per gebruiker: dat houdt "mijn huishouden" eenduidig.
  unique (user_id)
);

create table if not exists public.budget_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.budget_households(id) on delete cascade,
  code         text not null unique,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  used_by      uuid references auth.users(id) on delete set null,
  used_at      timestamptz
);

create table if not exists public.budget_pots (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.budget_households(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  emoji         text not null default '💶',
  monthly_limit numeric(12,2) not null default 0 check (monthly_limit >= 0),
  scope         text not null default 'shared' check (scope in ('shared', 'personal')),
  -- Alleen bij een persoonlijk potje: van wie het is.
  owner_id      uuid references auth.users(id) on delete cascade,
  sort_order    integer not null default 0,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  check ((scope = 'personal') = (owner_id is not null))
);

create table if not exists public.budget_accounts (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.budget_households(id) on delete cascade,
  owner_id            uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  iban                text,
  visibility          text not null default 'private' check (visibility in ('shared', 'private')),
  provider            text not null default 'enable_banking',
  provider_account_id text,
  consent_valid_until timestamptz,
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  unique (provider, provider_account_id)
);

create table if not exists public.budget_transactions (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references public.budget_accounts(id) on delete cascade,
  household_id   uuid not null references public.budget_households(id) on delete cascade,
  booked_on      date not null,
  -- Negatief = geld eraf, positief = geld erbij.
  amount         numeric(12,2) not null,
  currency       text not null default 'EUR',
  counterparty   text,
  description    text,
  pot_id         uuid references public.budget_pots(id) on delete set null,
  pot_status     text not null default 'unassigned'
                   check (pot_status in ('unassigned', 'suggested', 'confirmed')),
  provider_tx_id text not null,
  created_at     timestamptz not null default now(),
  unique (account_id, provider_tx_id)
);

create index if not exists budget_tx_household_date on public.budget_transactions (household_id, booked_on desc);
create index if not exists budget_tx_pot on public.budget_transactions (pot_id);

-- ─── helpers (security definer, zodat policies elkaar niet recursief raken) ──

create or replace function public.budget_my_household()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from budget_members where user_id = auth.uid()
$$;

create or replace function public.budget_is_member(hh uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from budget_members where household_id = hh and user_id = auth.uid())
$$;

-- Mag de ingelogde gebruiker deze transactie zien? Eigen of gedeelde rekening,
-- óf een privé-transactie die in een gedeeld potje is ingedeeld.
create or replace function public.budget_can_see_tx(acc uuid, pot uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from budget_accounts a
    where a.id = acc
      and budget_is_member(a.household_id)
      and (a.visibility = 'shared' or a.owner_id = auth.uid())
  ) or exists (
    select 1 from budget_pots p
    where p.id = pot and p.scope = 'shared' and budget_is_member(p.household_id)
  )
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.budget_households   enable row level security;
alter table public.budget_members      enable row level security;
alter table public.budget_invites      enable row level security;
alter table public.budget_pots         enable row level security;
alter table public.budget_accounts     enable row level security;
alter table public.budget_transactions enable row level security;

drop policy if exists hh_select on public.budget_households;
create policy hh_select on public.budget_households for select using (budget_is_member(id));
drop policy if exists hh_update on public.budget_households;
create policy hh_update on public.budget_households for update using (budget_is_member(id));
-- Aanmaken gaat via budget_create_household(); geen directe insert.

drop policy if exists members_select on public.budget_members;
create policy members_select on public.budget_members for select using (budget_is_member(household_id));
drop policy if exists members_update_self on public.budget_members;
create policy members_update_self on public.budget_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists members_leave on public.budget_members;
create policy members_leave on public.budget_members for delete using (user_id = auth.uid());

drop policy if exists invites_all on public.budget_invites;
create policy invites_all on public.budget_invites for all
  using (budget_is_member(household_id))
  with check (budget_is_member(household_id) and created_by = auth.uid());

drop policy if exists pots_select on public.budget_pots;
create policy pots_select on public.budget_pots for select
  using (budget_is_member(household_id) and (scope = 'shared' or owner_id = auth.uid()));
drop policy if exists pots_write on public.budget_pots;
create policy pots_write on public.budget_pots for all
  using (budget_is_member(household_id) and (scope = 'shared' or owner_id = auth.uid()))
  with check (budget_is_member(household_id) and (scope = 'shared' or owner_id = auth.uid()));

drop policy if exists accounts_select on public.budget_accounts;
create policy accounts_select on public.budget_accounts for select
  using (budget_is_member(household_id) and (visibility = 'shared' or owner_id = auth.uid()));
drop policy if exists accounts_owner_write on public.budget_accounts;
create policy accounts_owner_write on public.budget_accounts for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Rekeningen aanmaken en verwijderen gebeurt server-side (fase 2, service role).

drop policy if exists tx_select on public.budget_transactions;
create policy tx_select on public.budget_transactions for select
  using (budget_can_see_tx(account_id, pot_id));
drop policy if exists tx_categorize on public.budget_transactions;
create policy tx_categorize on public.budget_transactions for update
  using (budget_can_see_tx(account_id, pot_id))
  with check (budget_is_member(household_id));
-- Transacties toevoegen doet alleen de sync (service role).

-- ─── RPC's ───────────────────────────────────────────────────────────────────

create or replace function public.budget_create_household(p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hh uuid;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if exists (select 1 from budget_members where user_id = auth.uid()) then
    raise exception 'Je zit al in een huishouden';
  end if;
  insert into budget_households (name, created_by) values (trim(p_name), auth.uid()) returning id into hh;
  insert into budget_members (household_id, user_id, display_name, role)
    values (hh, auth.uid(), trim(p_display_name), 'owner');
  return hh;
end $$;

-- Wie nog geen lid is, kan de uitnodiging via RLS niet lezen; daarom deze functie.
create or replace function public.budget_join_household(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv budget_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if exists (select 1 from budget_members where user_id = auth.uid()) then
    raise exception 'Je zit al in een huishouden';
  end if;
  select * into inv from budget_invites
    where code = upper(trim(p_code)) and used_at is null and expires_at > now()
    for update;
  if not found then raise exception 'Code onbekend of verlopen'; end if;
  insert into budget_members (household_id, user_id, display_name, role)
    values (inv.household_id, auth.uid(), trim(p_display_name), 'member');
  update budget_invites set used_by = auth.uid(), used_at = now() where id = inv.id;
  return inv.household_id;
end $$;

revoke all on function public.budget_create_household(text, text) from public, anon;
revoke all on function public.budget_join_household(text, text) from public, anon;
grant execute on function public.budget_create_household(text, text) to authenticated;
grant execute on function public.budget_join_household(text, text) to authenticated;
grant execute on function public.budget_my_household() to authenticated;
grant execute on function public.budget_is_member(uuid) to authenticated;
grant execute on function public.budget_can_see_tx(uuid, uuid) to authenticated;

grant select, update on public.budget_households to authenticated;
grant select, update, delete on public.budget_members to authenticated;
grant select, insert, update, delete on public.budget_invites to authenticated;
grant select, insert, update, delete on public.budget_pots to authenticated;
grant select, update on public.budget_accounts to authenticated;
grant select, update on public.budget_transactions to authenticated;
