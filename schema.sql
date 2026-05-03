-- Training Entries table for AI trading bot training data
create table training_entries (
  id uuid default gen_random_uuid() primary key,
  screenshot_url text,
  tradingview_url text not null,
  is_valid_setup boolean not null,
  notes text,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security (optional: remove if not needed)
alter table training_entries enable row level security;

-- Allow all authenticated users to read and write (adjust as needed)
create policy "Authenticated users can read training entries"
  on training_entries for select
  to authenticated
  using (true);

create policy "Authenticated users can insert training entries"
  on training_entries for insert
  to authenticated
  with check (true);

-- Storage bucket: create a public bucket named 'screenshots'
-- Run this in the Supabase dashboard SQL editor or Storage UI:
-- insert into storage.buckets (id, name, public) values ('screenshots', 'screenshots', true);
