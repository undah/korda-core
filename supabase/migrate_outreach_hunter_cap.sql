-- ============================================================
-- Korda Outreach — per-niche Hunter lookup cap
--
-- The Hunter spend cap started life as an environment variable on the pipeline
-- host, which made it global and required a redeploy to change. It belongs
-- beside the other pacing settings on the niche, where it can differ per niche
-- and be edited from the console: Hunter is worth more credits on niches whose
-- businesses have a real web presence than on one-person shops.
--
-- Null means "use the pipeline default" (HUNTER_MAX_LOOKUPS_PER_RUN), so
-- existing niches keep behaving exactly as they do now.
--
-- Idempotent: safe to run more than once.
-- Apply in: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

alter table niches
  add column if not exists hunter_max_lookups integer;

-- 0 is meaningful (look nothing up this run); negatives are not.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'niches_hunter_max_lookups_check'
  ) then
    alter table niches
      add constraint niches_hunter_max_lookups_check
      check (hunter_max_lookups is null or hunter_max_lookups >= 0);
  end if;
end $$;
