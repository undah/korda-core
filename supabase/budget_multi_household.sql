-- KordaBudget — meerdere huishoudens per gebruiker, verwijderen en verlaten.
-- Uitvoeren in de Supabase SQL editor, ná budget_schema.sql. Idempotent.
--
-- Regels:
--   * Je kunt meerdere huishoudens aanmaken (max. 10) en bij meerdere aansluiten.
--   * Alleen wie het huishouden aanmaakte, kan het verwijderen (alles gaat mee).
--   * Wie via een code aansloot, kan het verlaten. De maker kan niet verlaten,
--     alleen verwijderen — anders blijft er een huishouden zonder beheerder over.
--   * Bij verlaten verdwijnen je persoonlijke potjes en je gekoppelde rekeningen
--     in dat huishouden mee; gedeelde potjes blijven van het huishouden.

alter table public.budget_members drop constraint if exists budget_members_user_id_key;
create index if not exists budget_members_user on public.budget_members (user_id);

-- Gaf "het" huishouden terug; met meerdere huishoudens bestaat dat niet meer.
drop function if exists public.budget_my_household();

-- Leden verlaten alleen via budget_leave_household(), zodat het opruimen gebeurt.
drop policy if exists members_leave on public.budget_members;

create or replace function public.budget_create_household(p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hh uuid;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if (select count(*) from budget_households where created_by = auth.uid()) >= 10 then
    raise exception 'Je kunt maximaal 10 huishoudens aanmaken';
  end if;
  insert into budget_households (name, created_by) values (trim(p_name), auth.uid()) returning id into hh;
  insert into budget_members (household_id, user_id, display_name, role)
    values (hh, auth.uid(), trim(p_display_name), 'owner');
  return hh;
end $$;

create or replace function public.budget_join_household(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv budget_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  select * into inv from budget_invites
    where code = upper(trim(p_code)) and used_at is null and expires_at > now()
    for update;
  if not found then raise exception 'Code onbekend of verlopen'; end if;
  if exists (select 1 from budget_members where household_id = inv.household_id and user_id = auth.uid()) then
    raise exception 'Je zit al in dit huishouden';
  end if;
  insert into budget_members (household_id, user_id, display_name, role)
    values (inv.household_id, auth.uid(), trim(p_display_name), 'member');
  update budget_invites set used_by = auth.uid(), used_at = now() where id = inv.id;
  return inv.household_id;
end $$;

create or replace function public.budget_delete_household(p_household uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from budget_households where id = p_household and created_by = auth.uid()) then
    raise exception 'Alleen wie het huishouden aanmaakte, kan het verwijderen';
  end if;
  delete from budget_households where id = p_household;  -- cascades to everything inside
end $$;

create or replace function public.budget_leave_household(p_household uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from budget_members where household_id = p_household and user_id = auth.uid()) then
    raise exception 'Je zit niet in dit huishouden';
  end if;
  if exists (select 1 from budget_households where id = p_household and created_by = auth.uid()) then
    raise exception 'Je hebt dit huishouden aangemaakt; verwijder het in plaats van het te verlaten';
  end if;
  delete from budget_pots where household_id = p_household and owner_id = auth.uid();
  delete from budget_accounts where household_id = p_household and owner_id = auth.uid();
  delete from budget_members where household_id = p_household and user_id = auth.uid();
end $$;

revoke all on function public.budget_delete_household(uuid) from public, anon;
revoke all on function public.budget_leave_household(uuid) from public, anon;
grant execute on function public.budget_delete_household(uuid) to authenticated;
grant execute on function public.budget_leave_household(uuid) to authenticated;
revoke delete on public.budget_members from authenticated;
