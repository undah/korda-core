-- KordaBudget — doelen, handmatige uitgaven, splitsen, regels, vaste lasten,
-- verrekenen, maandafsluiting, wensenlijst en buffer.
-- Uitvoeren in de Supabase SQL editor, ná budget_multi_household.sql. Idempotent.

-- ─── uitbreidingen op bestaande tabellen ────────────────────────────────────

-- Vast potje (huur, abonnementen): geen tempo-voorspelling, telt niet mee in
-- "veilig per dag" omdat het geld al gereserveerd is.
alter table public.budget_pots
  add column if not exists kind text not null default 'flexibel';
alter table public.budget_pots drop constraint if exists budget_pots_kind_check;
alter table public.budget_pots add constraint budget_pots_kind_check check (kind in ('flexibel', 'vast'));

-- Verdeelsleutel voor verrekenen: aandeel = gewicht / som van gewichten.
alter table public.budget_members
  add column if not exists split_weight numeric(6,2) not null default 1;
alter table public.budget_members drop constraint if exists budget_members_split_weight_check;
alter table public.budget_members add constraint budget_members_split_weight_check check (split_weight > 0);

-- Spaarsaldo voor de buffermeter (handmatig tot de bankkoppeling het levert).
alter table public.budget_households
  add column if not exists savings_balance numeric(12,2),
  add column if not exists savings_updated_at timestamptz;

-- Gezamenlijke rekening: betalingen daarvan zijn van iedereen en tellen niet
-- mee bij verrekenen.
alter table public.budget_accounts add column if not exists is_joint boolean not null default false;

alter table public.budget_transactions add column if not exists note text;

-- ─── splitsen ────────────────────────────────────────────────────────────────

create table if not exists public.budget_tx_splits (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.budget_transactions(id) on delete cascade,
  household_id   uuid not null references public.budget_households(id) on delete cascade,
  pot_id         uuid references public.budget_pots(id) on delete set null,
  -- Zelfde teken als de transactie: negatief = uitgave.
  amount         numeric(12,2) not null,
  created_at     timestamptz not null default now()
);
create index if not exists budget_splits_tx on public.budget_tx_splits (transaction_id);
create index if not exists budget_splits_pot on public.budget_tx_splits (pot_id);

-- Zichtbaarheid van een transactie kijkt nu ook naar de splitsregels: een
-- privé-uitgave die deels in een gedeeld potje valt, is voor de partner zichtbaar.
-- De oude versie (2 parameters) eerst weg, anders worden aanroepen dubbelzinnig;
-- daarvoor moeten de policies die hem gebruiken eerst weg.
drop policy if exists tx_select on public.budget_transactions;
drop policy if exists tx_categorize on public.budget_transactions;
drop function if exists public.budget_can_see_tx(uuid, uuid);

create or replace function public.budget_can_see_tx(acc uuid, pot uuid, tx uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from budget_accounts a
    where a.id = acc
      and budget_is_member(a.household_id)
      and (a.visibility = 'shared' or a.owner_id = auth.uid())
  ) or exists (
    select 1 from budget_pots p
    where p.id = pot and p.scope = 'shared' and budget_is_member(p.household_id)
  ) or exists (
    select 1 from budget_tx_splits s join budget_pots p on p.id = s.pot_id
    where s.transaction_id = tx and p.scope = 'shared' and budget_is_member(p.household_id)
  )
$$;
grant execute on function public.budget_can_see_tx(uuid, uuid, uuid) to authenticated;

drop policy if exists tx_select on public.budget_transactions;
create policy tx_select on public.budget_transactions for select
  using (budget_can_see_tx(account_id, pot_id, id));
drop policy if exists tx_categorize on public.budget_transactions;
create policy tx_categorize on public.budget_transactions for update
  using (budget_can_see_tx(account_id, pot_id, id))
  with check (budget_is_member(household_id));

alter table public.budget_tx_splits enable row level security;
drop policy if exists splits_all on public.budget_tx_splits;
create policy splits_all on public.budget_tx_splits for all
  using (exists (select 1 from budget_transactions t where t.id = budget_tx_splits.transaction_id))
  with check (
    budget_is_member(household_id)
    and exists (select 1 from budget_transactions t
                   where t.id = budget_tx_splits.transaction_id and t.household_id = budget_tx_splits.household_id)
  );
grant select, insert, update, delete on public.budget_tx_splits to authenticated;

-- Eén regel per (deel van een) uitgave: onverdeelde transacties plus splitsregels.
-- security_invoker: de RLS van de onderliggende tabellen blijft gelden.
create or replace view public.budget_tx_lines with (security_invoker = true) as
  select t.id as transaction_id, t.household_id, t.account_id, t.booked_on, t.pot_id, t.amount
  from public.budget_transactions t
  where not exists (select 1 from public.budget_tx_splits s where s.transaction_id = t.id)
  union all
  select s.transaction_id, s.household_id, t.account_id, t.booked_on, s.pot_id, s.amount
  from public.budget_tx_splits s
  join public.budget_transactions t on t.id = s.transaction_id;
grant select on public.budget_tx_lines to authenticated;

-- ─── handmatige uitgaven ─────────────────────────────────────────────────────

-- Contant, Tikkie, iets dat de bank (nog) niet ziet. Elke gebruiker krijgt per
-- huishouden een eigen, privé "Handmatig"-rekening; die wordt hier aangemaakt.
create or replace function public.budget_add_manual_tx(
  p_household uuid, p_booked_on date, p_amount numeric, p_counterparty text,
  p_pot uuid default null, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare acc uuid; tx uuid;
begin
  if not budget_is_member(p_household) then raise exception 'Je zit niet in dit huishouden'; end if;
  if p_amount = 0 then raise exception 'Bedrag mag geen nul zijn'; end if;
  if p_pot is not null and not exists (
    select 1 from budget_pots where id = p_pot and household_id = p_household
      and (scope = 'shared' or owner_id = auth.uid())
  ) then raise exception 'Onbekend potje'; end if;

  select id into acc from budget_accounts
    where household_id = p_household and owner_id = auth.uid() and provider = 'handmatig';
  if acc is null then
    insert into budget_accounts (household_id, owner_id, name, visibility, provider, provider_account_id)
      values (p_household, auth.uid(), 'Handmatig', 'private', 'handmatig',
              'handmatig:' || p_household || ':' || auth.uid())
      returning id into acc;
  end if;

  insert into budget_transactions (account_id, household_id, booked_on, amount, counterparty, pot_id,
                                   pot_status, note, provider_tx_id)
    values (acc, p_household, p_booked_on, round(p_amount, 2), nullif(trim(p_counterparty), ''), p_pot,
            case when p_pot is null then 'unassigned' else 'confirmed' end, nullif(trim(p_note), ''),
            gen_random_uuid()::text)
    returning id into tx;
  return tx;
end $$;

create or replace function public.budget_delete_manual_tx(p_tx uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from budget_transactions t using budget_accounts a
    where t.id = p_tx and a.id = t.account_id and a.owner_id = auth.uid() and a.provider = 'handmatig';
  if not found then raise exception 'Alleen je eigen handmatige uitgaven kun je verwijderen'; end if;
end $$;

revoke all on function public.budget_add_manual_tx(uuid, date, numeric, text, uuid, text) from public, anon;
revoke all on function public.budget_delete_manual_tx(uuid) from public, anon;
grant execute on function public.budget_add_manual_tx(uuid, date, numeric, text, uuid, text) to authenticated;
grant execute on function public.budget_delete_manual_tx(uuid) to authenticated;

-- ─── regels: tegenpartij → potje ─────────────────────────────────────────────

create table if not exists public.budget_rules (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.budget_households(id) on delete cascade,
  counterparty text not null,          -- lowercase, getrimd
  pot_id       uuid not null references public.budget_pots(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (household_id, counterparty)
);
alter table public.budget_rules enable row level security;
drop policy if exists rules_all on public.budget_rules;
create policy rules_all on public.budget_rules for all
  using (budget_is_member(household_id))
  with check (budget_is_member(household_id)
              and exists (select 1 from budget_pots p
                          where p.id = budget_rules.pot_id and p.household_id = budget_rules.household_id));
grant select, insert, update, delete on public.budget_rules to authenticated;

-- ─── vaste lasten en abonnementen ────────────────────────────────────────────

create table if not exists public.budget_recurring (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.budget_households(id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 60),
  counterparty     text,                -- herkenning in transacties (lowercase)
  amount           numeric(12,2) not null check (amount > 0),
  previous_amount  numeric(12,2),
  price_changed_at timestamptz,
  cadence          text not null default 'maand' check (cadence in ('maand', 'jaar')),
  day_of_month     integer not null default 1 check (day_of_month between 1 and 31),
  month_of_year    integer check (month_of_year between 1 and 12),
  is_subscription  boolean not null default false,
  pot_id           uuid references public.budget_pots(id) on delete set null,
  scope            text not null default 'shared' check (scope in ('shared', 'personal')),
  owner_id         uuid references auth.users(id) on delete cascade,
  source           text not null default 'handmatig' check (source in ('handmatig', 'herkend')),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  check ((scope = 'personal') = (owner_id is not null)),
  check ((cadence = 'jaar') = (month_of_year is not null))
);
alter table public.budget_recurring enable row level security;
drop policy if exists recurring_all on public.budget_recurring;
create policy recurring_all on public.budget_recurring for all
  using (budget_is_member(household_id) and (scope = 'shared' or owner_id = auth.uid()))
  with check (budget_is_member(household_id) and (scope = 'shared' or owner_id = auth.uid()));
grant select, insert, update, delete on public.budget_recurring to authenticated;

-- ─── spaardoelen ─────────────────────────────────────────────────────────────

create table if not exists public.budget_goals (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.budget_households(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  emoji        text not null default '🎯',
  target       numeric(12,2) not null check (target > 0),
  deadline     date,
  scope        text not null default 'shared' check (scope in ('shared', 'personal')),
  owner_id     uuid references auth.users(id) on delete cascade,
  -- Hier gaat het maandrestant naartoe, tenzij bij het afsluiten anders gekozen.
  receives_leftover boolean not null default false,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  check ((scope = 'personal') = (owner_id is not null))
);
alter table public.budget_goals enable row level security;
drop policy if exists goals_all on public.budget_goals;
create policy goals_all on public.budget_goals for all
  using (budget_is_member(household_id) and (scope = 'shared' or owner_id = auth.uid()))
  with check (budget_is_member(household_id) and (scope = 'shared' or owner_id = auth.uid()));
grant select, insert, update, delete on public.budget_goals to authenticated;

create table if not exists public.budget_goal_entries (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null references public.budget_goals(id) on delete cascade,
  household_id uuid not null references public.budget_households(id) on delete cascade,
  amount       numeric(12,2) not null check (amount <> 0),   -- negatief = opname
  kind         text not null default 'storting' check (kind in ('storting', 'opname', 'restant')),
  month        date,                                          -- bij 'restant': de afgesloten maand
  note         text,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists budget_goal_entries_goal on public.budget_goal_entries (goal_id);
alter table public.budget_goal_entries enable row level security;
drop policy if exists goal_entries_all on public.budget_goal_entries;
create policy goal_entries_all on public.budget_goal_entries for all
  using (exists (select 1 from budget_goals g where g.id = budget_goal_entries.goal_id))
  with check (budget_is_member(household_id) and created_by = auth.uid()
              and exists (select 1 from budget_goals g
                          where g.id = budget_goal_entries.goal_id and g.household_id = budget_goal_entries.household_id));
grant select, insert, update, delete on public.budget_goal_entries to authenticated;

-- ─── maandafsluiting ─────────────────────────────────────────────────────────

create table if not exists public.budget_month_closes (
  household_id uuid not null references public.budget_households(id) on delete cascade,
  month        date not null,                 -- eerste dag van de maand
  leftover     numeric(12,2) not null,
  goal_id      uuid references public.budget_goals(id) on delete set null,
  closed_by    uuid not null references auth.users(id) on delete cascade,
  closed_at    timestamptz not null default now(),
  primary key (household_id, month)
);
alter table public.budget_month_closes enable row level security;
drop policy if exists closes_all on public.budget_month_closes;
create policy closes_all on public.budget_month_closes for all
  using (budget_is_member(household_id))
  with check (budget_is_member(household_id) and closed_by = auth.uid());
grant select, insert, delete on public.budget_month_closes to authenticated;

-- ─── verrekenen ──────────────────────────────────────────────────────────────

create table if not exists public.budget_settlements (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.budget_households(id) on delete cascade,
  from_user    uuid not null references auth.users(id) on delete cascade,
  to_user      uuid not null references auth.users(id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  note         text,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  check (from_user <> to_user)
);
alter table public.budget_settlements enable row level security;
drop policy if exists settlements_select on public.budget_settlements;
create policy settlements_select on public.budget_settlements for select using (budget_is_member(household_id));
drop policy if exists settlements_insert on public.budget_settlements;
create policy settlements_insert on public.budget_settlements for insert
  with check (budget_is_member(household_id) and created_by = auth.uid()
              and auth.uid() in (from_user, to_user));
drop policy if exists settlements_delete on public.budget_settlements;
create policy settlements_delete on public.budget_settlements for delete using (created_by = auth.uid());
grant select, insert, delete on public.budget_settlements to authenticated;

-- Iedereen in het huishouden mag de verdeelsleutel aanpassen; het is een
-- gezamenlijke afspraak. (members_update_self dekt alleen de eigen rij.)
create or replace function public.budget_set_split_weights(p_household uuid, p_weights jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare k text; v numeric;
begin
  if not budget_is_member(p_household) then raise exception 'Je zit niet in dit huishouden'; end if;
  for k, v in select key, value::numeric from jsonb_each_text(p_weights) loop
    if v <= 0 then raise exception 'Een aandeel moet groter dan nul zijn'; end if;
    update budget_members set split_weight = v where household_id = p_household and user_id = k::uuid;
  end loop;
end $$;
revoke all on function public.budget_set_split_weights(uuid, jsonb) from public, anon;
grant execute on function public.budget_set_split_weights(uuid, jsonb) to authenticated;

-- ─── wensenlijst ─────────────────────────────────────────────────────────────

create table if not exists public.budget_wishes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.budget_households(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  scope        text not null default 'personal' check (scope in ('shared', 'personal')),
  name         text not null check (char_length(name) between 1 and 80),
  price        numeric(12,2) check (price >= 0),
  url          text,
  wait_until   timestamptz not null default now() + interval '48 hours',
  status       text not null default 'wachten' check (status in ('wachten', 'gekocht', 'geschrapt')),
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.budget_wishes enable row level security;
drop policy if exists wishes_all on public.budget_wishes;
create policy wishes_all on public.budget_wishes for all
  using (budget_is_member(household_id) and (scope = 'shared' or owner_id = auth.uid()))
  with check (budget_is_member(household_id) and owner_id = auth.uid());
grant select, insert, update, delete on public.budget_wishes to authenticated;

-- Spaarsaldo bijwerken mag elk lid (hh_update dekte dit al); joint-vlag op
-- rekeningen zet de eigenaar (accounts_owner_write dekte dit al).

-- Verrekenen moet weten wie een gedeelde uitgave betaalde, ook vanaf een
-- privé-rekening van de partner. Deze functie geeft alleen van wie een rekening
-- is en of hij gezamenlijk is — geen naam, geen IBAN, geen saldo.
create or replace function public.budget_account_owners(p_household uuid)
returns table (account_id uuid, owner_id uuid, is_joint boolean)
language sql stable security definer set search_path = public as $$
  select id, owner_id, is_joint from budget_accounts
  where household_id = p_household and budget_is_member(p_household)
$$;
revoke all on function public.budget_account_owners(uuid) from public, anon;
grant execute on function public.budget_account_owners(uuid) to authenticated;
