-- ============================================================
-- Korda Outreach — Hunter.io enrichment
--
-- The website crawler finds a mailbox but usually not whose it is, so runs come
-- back full of info@ and verkoop@. Hunter indexes addresses alongside a name,
-- job title and seniority, which is what turns a company mailbox into a named
-- owner. This adds the per-niche toggle and lets contacts record that source.
--
-- Idempotent: safe to run more than once.
-- Apply in: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

-- Off by default: Hunter bills a credit per domain searched, so enabling it is
-- a deliberate per-niche decision rather than something a new niche inherits.
alter table niches
  add column if not exists enrich_hunter boolean not null default false;

-- `contacts.source` gains 'hunter'. Recreate the constraint with the full list
-- rather than dropping it permanently, so the column stays honest in between.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'contacts_source_check'
  ) then
    alter table contacts drop constraint contacts_source_check;
  end if;

  alter table contacts
    add constraint contacts_source_check
    check (source in ('website', 'kvk', 'manual', 'email-guess', 'osm', 'hunter'));
end $$;
