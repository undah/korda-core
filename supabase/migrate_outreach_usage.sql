-- ============================================================
-- Korda Outreach — external API usage ledger
--
-- Three paid APIs run behind this system and none of them announced what they
-- were costing. Hunter is the sharp one: it bills a credit per domain searched
-- whether or not it finds anything, and the entry plans are tens of searches a
-- month, so a single unlucky run can empty the account with nothing to show.
--
-- Two layers, because no single one works for all three providers:
--
--   1. This table — our own record of every billable call. Works for every
--      provider, survives a provider having no usage API at all (Google Places
--      does not), and is the only layer that can attribute spend to a specific
--      run or niche.
--   2. A live balance read from the provider, where one exists. Hunter's
--      /v2/account is free to call and authoritative. That is the number to
--      trust for "how much is left"; this table is the number to trust for
--      "where did it go".
--
-- `units` is deliberately generic — a Hunter credit, a Places request, an
-- Anthropic call. Token counts sit in their own columns because only one
-- provider has them. `cost_usd` is a snapshot taken at write time, so a later
-- price change does not silently rewrite history.
--
-- Idempotent: safe to run more than once.
-- Apply in: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

create table if not exists api_usage (
  id            uuid primary key default gen_random_uuid(),

  -- 'hunter' | 'anthropic' | 'google_places'
  provider      text not null,
  -- What was called: 'domain_search', 'personalize', 'search_text', …
  operation     text not null,

  -- Billable units in the provider's own terms. One Hunter credit, one Places
  -- request, one Claude call.
  units         numeric not null default 1,

  -- Anthropic only; null elsewhere.
  input_tokens  integer,
  output_tokens integer,

  -- Estimated, in USD, at the rate that applied when the row was written.
  -- Null when the provider's price isn't known well enough to state one.
  cost_usd      numeric(12, 6),

  -- What this spend was for. Null for calls made outside a pipeline run
  -- (an individual send's personalization, for instance).
  run_id        uuid references run_log(id) on delete set null,
  niche_id      uuid references niches(id) on delete set null,

  -- Whatever is worth keeping for one call: the domain searched, the model
  -- used, an error code. Not indexed; for reading, not filtering.
  meta          jsonb,

  occurred_at   timestamptz not null default now()
);

-- The two questions this table answers: "what has this provider cost lately"
-- and "what did that run spend".
create index if not exists api_usage_provider_time_idx
  on api_usage(provider, occurred_at desc);
create index if not exists api_usage_run_idx
  on api_usage(run_id) where run_id is not null;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- The console reads this through the browser's anon client. Nothing secret is
-- in it — no keys, no addresses, just counts — but it is still gated to
-- authenticated users, and writes belong to the pipeline's service role, which
-- bypasses RLS entirely.
alter table api_usage enable row level security;

drop policy if exists "authenticated reads api_usage" on api_usage;
create policy "authenticated reads api_usage" on api_usage
  for select to authenticated using (true);
