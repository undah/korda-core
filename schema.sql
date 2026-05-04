-- ============================================================
-- KordaAI Training — full schema
-- Run this in Supabase SQL Editor (fresh setup)
-- ============================================================

-- Training entries table
create table if not exists training_entries (
  id              uuid default gen_random_uuid() primary key,
  tradingview_url text not null,
  is_valid_setup  boolean not null,
  session         text check (session in ('london', 'new_york', 'asia')),
  submitted_by    text,
  notes           text,
  created_at      timestamp with time zone default now()
);

-- Disable RLS (internal tool — no per-user isolation needed)
alter table training_entries disable row level security;


-- ============================================================
-- Migration — run these if the table already exists
-- ============================================================

-- Drop screenshot_url if it exists from a previous version
alter table training_entries drop column if exists screenshot_url;

-- Add session column if it doesn't exist yet
alter table training_entries
  add column if not exists session text
  check (session in ('london', 'new_york', 'asia'));

-- Add submitted_by column if it doesn't exist yet
alter table training_entries
  add column if not exists submitted_by text;


-- ============================================================
-- Screenshot Scheduler tables
-- ============================================================

create table if not exists screenshot_config (
  id                uuid default gen_random_uuid() primary key,
  enabled           boolean not null default false,
  schedule_mode     text not null default 'interval'
                      check (schedule_mode in ('interval', 'fixed')),
  interval_minutes  integer default 15,
  fixed_time        text,
  days              text[] default '{}',
  sessions          text[] default '{always}',
  max_runs_per_day  integer default 24,
  updated_at        timestamp with time zone default now()
);

alter table screenshot_config disable row level security;

create table if not exists screenshot_log (
  id            uuid default gen_random_uuid() primary key,
  status        text not null check (status in ('success', 'error', 'skipped')),
  timestamp     timestamp with time zone default now(),
  image_base64  text,
  reason        text,
  created_at    timestamp with time zone default now()
);

alter table screenshot_log disable row level security;

-- Add pairs column if it doesn't exist yet
alter table screenshot_config
  add column if not exists pairs text[] default '{}';

-- Add pair column to screenshot_log if it doesn't exist yet
alter table screenshot_log
  add column if not exists pair text;


-- ============================================================
-- Mistakes table
-- ============================================================

create table if not exists mistakes (
  id             uuid default gen_random_uuid() primary key,
  screenshot_url text not null,
  mistake        text not null,
  reason         text,
  created_at     timestamp with time zone default now()
);

alter table mistakes disable row level security;
grant all on mistakes to anon;
grant all on mistakes to authenticated;
