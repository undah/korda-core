-- ============================================================
-- Korda Outreach — sending identities
--
-- Sending ran through one hardcoded address on one domain. That caps safe
-- volume at roughly 100-150/day: the published norms are 30-50 emails per
-- mailbox per day and 2-3 mailboxes per domain, because concentrating volume on
-- one domain concentrates the reputation risk too. Anything higher needs a pool
-- of mailboxes spread across several secondary domains, each warmed separately.
--
-- This adds the pool. The sender picks the next identity with capacity left
-- today, so daily caps become per-mailbox instead of one global number.
--
-- CREDENTIALS ARE DELIBERATELY NOT STORED HERE. `credential_key` names an
-- environment variable on Cloudflare Pages; the send function resolves it at
-- send time. The console reads this table through the browser's anon client, so
-- an API key in a column would be one RLS mistake away from being public.
--
-- Idempotent: safe to run more than once.
-- Apply in: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

create table if not exists sending_identities (
  id              uuid primary key default gen_random_uuid(),
  label           text not null,
  from_email      text not null unique,
  from_name       text,
  reply_to        text,

  -- Which adapter sends this. Adding a provider means adding an adapter in
  -- functions/api/outreach/_providers.js and a value here.
  provider        text not null default 'resend',

  -- Names the env var holding this identity's API key, e.g. 'RESEND_API_KEY'
  -- or 'SMARTLEAD_KEY_A'. Never the key itself.
  credential_key  text not null default 'RESEND_API_KEY',

  -- 30-50/day is the accepted safe band for cold sending per mailbox.
  daily_cap       integer not null default 40 check (daily_cap >= 0),

  -- Warm-up ramps this identity from 5/day. Null means no ramp: only set that
  -- for a mailbox with existing reputation.
  warmup_started_on date,

  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists sending_identities_active_idx
  on sending_identities(active) where active;

-- Which mailbox actually sent a message. Needed to count today's volume per
-- identity, and to trace a deliverability problem back to one mailbox.
alter table outreach_messages
  add column if not exists identity_id uuid references sending_identities(id) on delete set null;

create index if not exists messages_identity_sent_idx
  on outreach_messages(identity_id, sent_at) where status = 'sent';

drop trigger if exists trg_identities_updated on sending_identities;
create trigger trg_identities_updated before update on sending_identities
  for each row execute function set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Readable and manageable from the console. Safe precisely because no secret
-- lives in this table.
alter table sending_identities enable row level security;

drop policy if exists "authenticated manages sending_identities" on sending_identities;
create policy "authenticated manages sending_identities" on sending_identities
  for all to authenticated using (true) with check (true);

-- No seed row on purpose. An empty pool means the sender falls back to the
-- OUTREACH_FROM / RESEND_API_KEY env pair it already used, so this migration
-- changes nothing until identities are actually added in the console. Seeding a
-- placeholder address would instead create an identity that silently fails to
-- send, which is a worse first experience than no identities at all.
