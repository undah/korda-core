-- supabase/budget_soortregels.sql — "always income" / "always a transfer" per counterparty.
-- Run after budget_groep.sql. Safe to run twice.
--
-- A rule now points at a pot (suggested, you confirm) or at a kind: income or
-- an own transfer. Kind rules are applied straight away, also by the bank sync:
-- a weekly salary is income every week, there's nothing to confirm.

alter table public.budget_rules alter column pot_id drop not null;
alter table public.budget_rules add column if not exists soort text
  check (soort in ('inkomen', 'overboeking'));
alter table public.budget_rules drop constraint if exists budget_rules_pot_of_soort;
alter table public.budget_rules add constraint budget_rules_pot_of_soort
  check ((pot_id is null) <> (soort is null));

drop policy if exists rules_all on public.budget_rules;
create policy rules_all on public.budget_rules for all
  using (budget_is_member(household_id))
  with check (
    budget_is_member(household_id)
    and (
      soort is not null
      or exists (select 1 from budget_pots p
                 where p.id = budget_rules.pot_id and p.household_id = budget_rules.household_id)
    )
  );

-- Mark unsorted transactions that match a kind rule. Same normalising as the
-- app (trimmed, lowercase, single spaces). Income rules only touch money in.
-- Returns how many were marked. Callable by members, and by the server.
create or replace function public.budget_pas_soortregels(p_household uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is not null and not budget_is_member(p_household) then
    raise exception 'Je zit niet in dit huishouden';
  end if;
  update budget_transactions t
     set soort = r.soort, pot_status = 'confirmed'
    from budget_rules r
   where r.household_id = p_household and r.soort is not null
     and t.household_id = p_household
     and t.pot_id is null and t.soort is null
     and not exists (select 1 from budget_tx_splits s where s.transaction_id = t.id)
     and lower(regexp_replace(btrim(t.counterparty), '\s+', ' ', 'g')) = r.counterparty
     and (r.soort = 'overboeking' or t.amount > 0);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.budget_pas_soortregels(uuid) from public, anon;
grant execute on function public.budget_pas_soortregels(uuid) to authenticated, service_role;
