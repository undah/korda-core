-- supabase/budget_push.sql — push notifications per device.
-- Run after budget_pending.sql. Safe to run twice.

-- One row per device that turned notifications on. The endpoint is the push
-- service's address for that browser; p256dh and auth are its public keys,
-- so only that browser can read what we send.
create table if not exists public.budget_push_abonnementen (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table public.budget_push_abonnementen enable row level security;
drop policy if exists push_eigen on public.budget_push_abonnementen;
create policy push_eigen on public.budget_push_abonnementen for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.budget_push_abonnementen from anon, authenticated;
grant select, delete on public.budget_push_abonnementen to authenticated;

-- Save this device for the signed-in user. A device that was someone else's
-- (a shared tablet, a new login) moves to whoever turns it on now.
create or replace function public.budget_bewaar_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log eerst in'; end if;
  if p_endpoint !~ '^https://' then raise exception 'Ongeldig push-adres'; end if;
  insert into budget_push_abonnementen (user_id, endpoint, p256dh, auth)
    values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;
revoke all on function public.budget_bewaar_push(text, text, text) from public, anon;
grant execute on function public.budget_bewaar_push(text, text, text) to authenticated;

-- What went out to whom, so every notification is sent once. Server only.
create table if not exists public.budget_meldingen_log (
  user_id    uuid not null references auth.users(id) on delete cascade,
  sleutel    text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, sleutel)
);
alter table public.budget_meldingen_log enable row level security;
revoke all on public.budget_meldingen_log from anon, authenticated;
