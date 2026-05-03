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
