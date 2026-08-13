-- ============================================================
-- Korda Outreach — add provider-aware discovery to `niches`
--
-- The original outreach schema only knew about Google Places. This adds the
-- columns the Outreach console expects so a niche can instead be discovered
-- through Overpass (OpenStreetMap), which has no ratings but is free.
--
-- Idempotent: safe to run more than once.
-- Apply in: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

alter table niches
  add column if not exists provider text not null default 'google',
  add column if not exists osm_filters text[] not null default '{}';

-- Keep the column honest rather than trusting the app to only write valid values.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'niches_provider_check'
  ) then
    alter table niches
      add constraint niches_provider_check check (provider in ('google', 'overpass'));
  end if;
end $$;

-- Existing rows were all Google-based; the default above already covers them,
-- but be explicit in case any row was inserted with a null before the default.
update niches set provider = 'google' where provider is null;

-- `contacts.source` gains 'osm' once Overpass discovery can create contacts.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'contacts_source_check'
  ) then
    alter table contacts drop constraint contacts_source_check;
  end if;

  alter table contacts
    add constraint contacts_source_check
    check (source in ('website', 'kvk', 'manual', 'email-guess', 'osm'));
end $$;
