-- supabase/budget_soort.sql — mark a transaction as income or an own transfer.
-- Run after budget_bank.sql. Safe to run twice.
--
-- Income (salary, a refund from the tax office) and transfers between your own
-- accounts aren't spending and don't belong in a pot. Marking them takes them
-- out of the "nog indelen" inbox and out of the spending totals.
alter table public.budget_transactions add column if not exists soort text
  check (soort in ('inkomen', 'overboeking'));
