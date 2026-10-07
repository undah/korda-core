-- supabase/budget_pending.sql — card payments the bank hasn't booked yet.
-- Run after budget_soortregels.sql. Safe to run twice.
--
-- Pending payments show up within minutes instead of a day later. They count
-- in pots like any other payment; when the bank books one, the server turns
-- the pending row into the booked one (keeping its pot), and a reservation
-- that disappears without being booked is removed.
alter table public.budget_transactions add column if not exists in_behandeling boolean not null default false;
