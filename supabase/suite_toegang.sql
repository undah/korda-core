-- supabase/suite_toegang.sql — who may use which Korda app, and who manages accounts.
-- Safe to run twice. Run BEFORE turning on "Allow new users to sign up".
--
-- Anyone can now make an account (KordaBudget's magic link). Every account
-- gets KordaBudget, KordaTracker and KordaTrading, each with only its own data.
-- Outreach, CRM and Training are given per person (korda_app_toegang): on the
-- first run, everyone who already has an account gets all three, so nothing
-- changes for them. Admins (korda_admins) manage accounts at /admin.
--
-- How the apps are closed: a RESTRICTIVE policy on each of their tables.
-- Restrictive policies are AND-ed with the permissive ones already there, so
-- this narrows access without touching (or needing to know) them. The service
-- role (Railway pipeline, Cloudflare functions) bypasses RLS and is unaffected.

-- ─── tables ──────────────────────────────────────────────────────────────────

create table if not exists public.korda_app_toegang (
  user_id    uuid not null references auth.users(id) on delete cascade,
  app        text not null check (app in ('outreach', 'crm', 'training')),
  granted_at timestamptz not null default now(),
  primary key (user_id, app)
);
alter table public.korda_app_toegang enable row level security;
revoke all on public.korda_app_toegang from anon, authenticated;

create table if not exists public.korda_admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.korda_admins enable row level security;
revoke all on public.korda_admins from anon, authenticated;

-- What admins changed, newest first on /admin. Written by the server only.
create table if not exists public.korda_admin_log (
  id        bigint generated always as identity primary key,
  door      uuid references auth.users(id) on delete set null,
  door_email text,
  wie       uuid,
  wie_email text,
  actie     text not null,
  details   text,
  at        timestamptz not null default now()
);
alter table public.korda_admin_log enable row level security;
revoke all on public.korda_admin_log from anon, authenticated;

-- Everyone who has an account today keeps all three. Only on the very first
-- run, so running this again never hands them to newer sign-ups.
insert into public.korda_app_toegang (user_id, app)
select u.id, a.app
from auth.users u cross join (values ('outreach'), ('crm'), ('training')) as a(app)
where not exists (select 1 from public.korda_app_toegang)
on conflict do nothing;

-- ─── checks the app and the policies use ─────────────────────────────────────

create or replace function public.korda_heeft_app(p_app text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.korda_app_toegang where user_id = auth.uid() and app = p_app);
$$;

create or replace function public.korda_mijn_apps()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(app order by app), '{}') from public.korda_app_toegang where user_id = auth.uid();
$$;

create or replace function public.korda_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.korda_admins where user_id = auth.uid());
$$;

revoke all on function public.korda_heeft_app(text) from public;
revoke all on function public.korda_mijn_apps() from public;
revoke all on function public.korda_is_admin() from public;
grant execute on function public.korda_heeft_app(text) to authenticated;
grant execute on function public.korda_mijn_apps() to authenticated;
grant execute on function public.korda_is_admin() to authenticated;

-- ─── close the three apps' tables ────────────────────────────────────────────

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('outreach', 'api_usage'), ('outreach', 'businesses'), ('outreach', 'campaigns'), ('outreach', 'contacts'),
      ('outreach', 'email_templates'), ('outreach', 'niches'), ('outreach', 'outreach_messages'),
      ('outreach', 'outreach_profile'), ('outreach', 'outreach_events'), ('outreach', 'run_log'),
      ('outreach', 'sending_domains'), ('outreach', 'sending_identities'), ('outreach', 'sequence_steps'),
      ('outreach', 'suppression_list'),
      ('crm', 'crm_profiles'), ('crm', 'leads'), ('crm', 'scripts'),
      ('training', 'concept_examples'), ('training', 'concept_journal'), ('training', 'mistakes'),
      ('training', 'screenshot_config'), ('training', 'screenshot_log'), ('training', 'strategy_rules'),
      ('training', 'training_entries')
    ) as v(app, tabel)
  loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = r.tabel) then
      execute format('alter table public.%I enable row level security', r.tabel);
      execute format('drop policy if exists alleen_met_toegang on public.%I', r.tabel);
      execute format(
        'create policy alleen_met_toegang on public.%I as restrictive for all to anon, authenticated
           using (public.korda_heeft_app(%L)) with check (public.korda_heeft_app(%L))', r.tabel, r.app, r.app);
      raise notice 'gesloten voor wie geen % heeft: %', r.app, r.tabel;
    else
      raise notice 'bestaat niet, overgeslagen: %', r.tabel;
    end if;
  end loop;

  -- A view runs as its owner and would skip the policies above; make it run as the reader.
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'outreach_ready') then
    execute 'alter view public.outreach_ready set (security_invoker = true)';
  end if;
end $$;

-- ─── make yourself admin ─────────────────────────────────────────────────────
-- Put the e-mail address you log in with between the quotes, then run this
-- file. Only admins can open /admin.
insert into public.korda_admins (user_id)
select id from auth.users where lower(email) = lower('JOUW-EMAIL-HIER')
on conflict do nothing;

-- ─── check, in one result ────────────────────────────────────────────────────
-- Admins, who has which app, and any table a signed-in stranger could reach
-- without RLS (worth a look before opening sign-ups).
select 'admin' as wat, u.email as wie from public.korda_admins a join auth.users u on u.id = a.user_id
union all
select 'app: ' || t.app, u.email from public.korda_app_toegang t join auth.users u on u.id = t.user_id
union all
select 'GEEN RLS', tablename from pg_tables where schemaname = 'public' and not rowsecurity
order by 1, 2;
