-- ============================================================
-- Korda Outreach — AI personalization
--
-- Every lead so far has been mailed with the same template, filled in with a
-- first name that's usually just "there" — most leads are info@ addresses
-- with no name attached. This adds what's needed to have Claude write a
-- genuinely personalized email per lead instead: source material to write
-- from, a stable offer profile so that material isn't retyped every time, and
-- an objective per send so "personalized" has a stated goal (reply, book a
-- call, a sale, warming a cold lead up) rather than being generic filler.
--
-- Idempotent: safe to run more than once.
-- Apply in: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

-- ── source material ──────────────────────────────────────────────────────────
-- The website enricher already downloads every prospect's HTML and, until now,
-- discarded it once emails and names were pulled out. site_extract is a capped
-- slice of that page (title, meta description, headings, body text) — the
-- material an LLM needs to write something specific instead of generic.
-- site_signals is cheap structural detail (booking widget present, contact
-- form present, social links present, "since <year>") detected from the same
-- fetch. Both are null until a niche with website enrichment on re-crawls the
-- business — existing rows personalize from metadata only until then.
alter table businesses
  add column if not exists site_extract text,
  add column if not exists site_signals jsonb,
  add column if not exists site_fetched_at timestamptz;

-- ── offer profile ────────────────────────────────────────────────────────────
-- What we sell, once, rather than re-explained in every generation prompt.
-- Singleton by convention (the console only ever creates/edits one row) rather
-- than enforced by a constraint — a hard singleton isn't worth the migration
-- complexity for a table one admin edits from a settings page.
create table if not exists outreach_profile (
  id              uuid primary key default gen_random_uuid(),
  company_name    text not null default '',
  offer           text not null default '',   -- what we sell, in plain language
  proof_points    text not null default '',   -- credibility: results, clients, numbers
  tone            text not null default '',   -- voice guidance for the model
  language        text not null default 'nl',
  sender_name     text not null default '',
  constraints     text not null default '',   -- hard rules: never claim X, always mention Y
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_outreach_profile_updated on outreach_profile;
create trigger trg_outreach_profile_updated before update on outreach_profile
  for each row execute function set_updated_at();

alter table outreach_profile enable row level security;

drop policy if exists "authenticated manages outreach_profile" on outreach_profile;
create policy "authenticated manages outreach_profile" on outreach_profile
  for all to authenticated using (true) with check (true);

-- ── objective + personalization mode ─────────────────────────────────────────
-- What a generated email is trying to do. Lives on both campaigns (the default
-- for every message in it) and messages (so one individually-sent email can
-- carry its own objective without a campaign row per email).
alter table campaigns
  add column if not exists objective text not null default 'reply'
    check (objective in ('reply', 'book_call', 'sale', 'warm_up')),
  add column if not exists objective_notes text,
  -- 'off': send the rendered template as-is (today's behaviour, unchanged).
  -- 'full': Claude writes the whole email. See migrate_outreach_sequences.sql
  -- and the console for how upfront-vs-at-send generation is chosen.
  add column if not exists personalize text not null default 'off'
    check (personalize in ('off', 'full'));

alter table outreach_messages
  -- Null means "inherit the campaign's objective" — set only when a message's
  -- objective differs from its campaign, which is the normal case for an
  -- individually-sent email that has no campaign-level default to fall back to.
  add column if not exists objective text
    check (objective is null or objective in ('reply', 'book_call', 'sale', 'warm_up')),
  add column if not exists personalized boolean not null default false,
  add column if not exists personalization_error text,
  add column if not exists personalization_model text;
