-- ============================================================
--  Migration: Add scripts feature to KordaCRM
--  Run this in: Supabase → SQL Editor → New query
--  (Only needed if the DB already exists — skip for fresh setups)
-- ============================================================

-- 1. Create scripts table
create table if not exists public.scripts (
  id           uuid        default gen_random_uuid() primary key,
  created_at   timestamptz default now()             not null,
  created_by   uuid        references auth.users(id) on delete cascade not null,
  title        text        not null,
  content      text        not null default ''
);

alter table public.scripts enable row level security;

create policy "scripts: read all"
  on public.scripts for select
  using (auth.role() = 'authenticated');

create policy "scripts: insert own"
  on public.scripts for insert
  with check (auth.uid() = created_by);

create policy "scripts: update own or admin"
  on public.scripts for update
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.crm_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "scripts: delete own or admin"
  on public.scripts for delete
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.crm_profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- 2. Add script_id column to existing leads table
alter table public.leads
  add column if not exists script_id uuid references public.scripts(id) on delete set null;
