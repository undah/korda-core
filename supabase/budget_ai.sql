-- supabase/budget_ai.sql — Claude's suggestion per payment (phase 3B).
-- Run after budget_push.sql. Safe to run twice.
--
-- A suggestion is only that: the payment stays unsorted until someone
-- confirms it. ai_at marks that Claude has looked, so a payment it couldn't
-- place isn't sent again on every sync.
alter table public.budget_transactions add column if not exists ai_pot_id uuid
  references public.budget_pots(id) on delete set null;
alter table public.budget_transactions add column if not exists ai_soort text
  check (ai_soort in ('inkomen', 'overboeking'));
alter table public.budget_transactions add column if not exists ai_zeker real;
alter table public.budget_transactions add column if not exists ai_at timestamptz;

create index if not exists budget_tx_ai_open on public.budget_transactions (household_id)
  where pot_id is null and soort is null and ai_at is null;

-- Store a batch of suggestions in one go. Server only (service role): the
-- browser can't write suggestions, so nobody can pass theirs off as Claude's.
-- Each entry: { "id": tx uuid, "pot": pot uuid or null, "soort": text or null, "zeker": 0..1 }
create or replace function public.budget_zet_ai(p_household uuid, p_voorstellen jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update budget_transactions t
     set ai_pot_id = nullif(v->>'pot', '')::uuid,
         ai_soort  = nullif(v->>'soort', ''),
         ai_zeker  = (v->>'zeker')::real,
         ai_at     = now()
    from jsonb_array_elements(p_voorstellen) v
   where t.id = (v->>'id')::uuid
     and t.household_id = p_household;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.budget_zet_ai(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.budget_zet_ai(uuid, jsonb) to service_role;
