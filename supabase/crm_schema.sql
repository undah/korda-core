-- ============================================================
--  KordaCRM — Supabase schema
--  Run this entire file in: Supabase → SQL Editor → New query
-- ============================================================

-- 1. CRM Profiles (maps auth users to their rep name)
-- ============================================================
create table if not exists public.crm_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  rep_name   text        not null default '',
  is_admin   boolean     not null default false
);

alter table public.crm_profiles enable row level security;

-- All authenticated users can read profiles (needed for dashboard/leaderboard)
create policy "crm_profiles: read all"
  on public.crm_profiles for select
  using (auth.role() = 'authenticated');

-- Users can only insert/update their own profile
create policy "crm_profiles: insert own"
  on public.crm_profiles for insert
  with check (auth.uid() = id);

create policy "crm_profiles: update own"
  on public.crm_profiles for update
  using (auth.uid() = id);


-- 2. Scripts (sales call scripts)
-- ============================================================
create table if not exists public.scripts (
  id           uuid        default gen_random_uuid() primary key,
  created_at   timestamptz default now()             not null,
  created_by   uuid        references auth.users(id) on delete cascade not null,
  title        text        not null,
  content      text        not null default ''
);

alter table public.scripts enable row level security;

-- All authenticated users can read scripts
create policy "scripts: read all"
  on public.scripts for select
  using (auth.role() = 'authenticated');

-- Users can only insert their own scripts
create policy "scripts: insert own"
  on public.scripts for insert
  with check (auth.uid() = created_by);

-- Users can update/delete their own scripts; admins can update/delete any
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


-- 3. Leads (sales call records)
-- ============================================================
create table if not exists public.leads (
  id               uuid        default gen_random_uuid() primary key,
  created_at       timestamptz default now()             not null,
  rep_id           uuid        references auth.users(id) on delete cascade not null,
  lead_naam        text        not null,
  tel_nummer       text        not null,
  datum            date        not null default current_date,
  tijdstip         time        not null default current_time,
  status           text        not null check (status in (
                     'Niet bereikt',
                     'Geen Gehoor',
                     'Niet Geïnteresseerd',
                     'Terugbellen',
                     'Geïnteresseerd',
                     'Gesloten'
                   )),
  resultaat        text        not null default '',
  deal_waarde      numeric,
  follow_up_datum  date,
  website_type     text        not null default '',
  script_id        uuid        references public.scripts(id) on delete set null
);

create index if not exists leads_rep_id_datum_idx on public.leads (rep_id, datum);
create index if not exists leads_datum_idx         on public.leads (datum);

alter table public.leads enable row level security;

-- All authenticated users can read all leads (dashboard, leaderboard, etc.)
create policy "leads: read all"
  on public.leads for select
  using (auth.role() = 'authenticated');

-- Reps can only insert leads for themselves
create policy "leads: insert own"
  on public.leads for insert
  with check (auth.uid() = rep_id);

-- Reps can update/delete their own leads
create policy "leads: update own"
  on public.leads for update
  using (auth.uid() = rep_id);

create policy "leads: delete own"
  on public.leads for delete
  using (auth.uid() = rep_id);

-- Admins can update any lead
create policy "leads: admin update any"
  on public.leads for update
  using (
    exists (
      select 1 from public.crm_profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Admins can delete any lead
create policy "leads: admin delete any"
  on public.leads for delete
  using (
    exists (
      select 1 from public.crm_profiles
      where id = auth.uid() and is_admin = true
    )
  );


-- ============================================================
--  SETUP INSTRUCTIONS
-- ============================================================
--
--  1. Create user accounts in Supabase → Authentication → Users:
--       jamiro@example.com   / <password>
--       easton@example.com   / <password>
--       gdionne@example.com  / <password>
--
--  2. After each user logs in for the first time, they will
--     be prompted to choose their rep name (Jamiro / Easton /
--     G'Dionne). The profile is created automatically.
--
--  3. To grant admin access to a specific user, run:
--       update public.crm_profiles
--       set is_admin = true
--       where rep_name = 'G''Dionne';   -- or whichever rep
--
--  4. Access the CRM at:  /crm/dashboard
-- ============================================================
