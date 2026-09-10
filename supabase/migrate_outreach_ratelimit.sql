-- migrate_outreach_ratelimit.sql
--
-- Send rate limiting: a rolling 24-hour window, a per-domain ceiling, and an
-- atomic claim.
--
-- Replaces counting that lived in application code, which had two faults:
--
--   1. It counted from Amsterdam midnight. A calendar boundary lets a mailbox
--      spend its whole cap at 23:00 and the whole cap again at 00:01 — the
--      exact burst a warming domain gets flagged for. Providers measure over
--      trailing 24 hours, so that is what we measure.
--
--   2. It read the count, then wrote, with the decision in between living in a
--      Node process. Two callers — the scheduler tick and an individual send
--      from the console — can interleave on their awaits, both read the same
--      number, and both send. Counting and claiming now happen inside one
--      transaction, under an advisory lock.
--
-- Safe to re-run.

-- ── sending domains ─────────────────────────────────────────────────────────
-- Reputation is tracked per mailbox AND per domain. Four mailboxes at 35/day is
-- 140 from one domain, which is already at the edge; more volume should mean
-- another domain, not a fifth mailbox on this one. The domain ceiling is what
-- makes that true instead of aspirational.
create table if not exists sending_domains (
  id                uuid primary key default gen_random_uuid(),
  domain            text not null unique,
  warmup_started_at timestamptz,
  daily_cap         integer not null default 150 check (daily_cap >= 0),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table sending_identities
  add column if not exists domain_id uuid references sending_domains(id) on delete set null;

-- Every existing mailbox already names its domain in from_email; derive rather
-- than ask anyone to retype it.
insert into sending_domains (domain)
select distinct lower(split_part(from_email, '@', 2))
from sending_identities
where from_email like '%@%'
on conflict (domain) do nothing;

update sending_identities si
set    domain_id = sd.id
from   sending_domains sd
where  si.domain_id is null
  and  sd.domain = lower(split_part(si.from_email, '@', 2));

create index if not exists identities_domain_idx on sending_identities(domain_id);

-- ── the claim ───────────────────────────────────────────────────────────────
-- 'sending' already means "in flight, not yet resolved", so a claim reuses it
-- rather than adding a synonym the console would also have to learn.
-- claimed_at is separate from sent_at, which stays null until the send lands —
-- the sweep needs to know when the claim was taken, not when it resolved.
alter table outreach_messages
  add column if not exists claimed_at timestamptz;

-- Every rate check filters on this. Without it each one is a sequential scan
-- over the whole send history, on the hot path of every send.
create index if not exists messages_sent_at_idx   on outreach_messages(sent_at desc) where sent_at is not null;
create index if not exists messages_claimed_idx   on outreach_messages(claimed_at)   where status = 'sending';
create index if not exists messages_identity_idx  on outreach_messages(identity_id);

-- ── atomic claim ────────────────────────────────────────────────────────────
-- Counts both windows and takes the slot in one transaction.
--
-- The advisory lock is keyed on the DOMAIN, not the mailbox: the domain counter
-- spans every mailbox under it, so locking per mailbox would let two mailboxes
-- on the same domain race past the domain ceiling together. Locking the domain
-- serialises both checks. It is a transaction-scoped lock, so it releases on
-- commit or rollback without any cleanup path.
--
-- In-flight claims count toward the caps. Counting only 'sent' would let a
-- burst of claims all pass before any of them resolved.
create or replace function claim_send_slot(
  p_message_id  uuid,
  p_identity_id uuid,
  p_domain_id   uuid,
  p_mailbox_cap integer,
  p_domain_cap  integer,
  p_window      interval default '24 hours'
) returns text
language plpgsql
as $$
declare
  v_cutoff     timestamptz := now() - p_window;
  v_mailbox_n  integer;
  v_domain_n   integer;
  v_claimed    integer;
begin
  if p_domain_id is not null then
    perform pg_advisory_xact_lock(hashtext('outreach_domain:' || p_domain_id::text));
  else
    perform pg_advisory_xact_lock(hashtext('outreach_mailbox:' || p_identity_id::text));
  end if;

  select count(*) into v_mailbox_n
  from   outreach_messages
  where  identity_id = p_identity_id
    and  status in ('sent', 'sending')
    and  coalesce(sent_at, claimed_at) > v_cutoff;

  if v_mailbox_n >= p_mailbox_cap then
    return 'mailbox_cap';
  end if;

  if p_domain_id is not null and p_domain_cap is not null then
    select count(*) into v_domain_n
    from   outreach_messages m
    join   sending_identities si on si.id = m.identity_id
    where  si.domain_id = p_domain_id
      and  m.status in ('sent', 'sending')
      and  coalesce(m.sent_at, m.claimed_at) > v_cutoff;

    if v_domain_n >= p_domain_cap then
      return 'domain_cap';
    end if;
  end if;

  -- Only a queued message can be claimed; anything else was already taken.
  update outreach_messages
  set    status      = 'sending',
         claimed_at  = now(),
         identity_id = p_identity_id
  where  id = p_message_id
    and  status = 'queued';

  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    return 'gone';
  end if;

  return 'ok';
end;
$$;

-- ── stale claim sweep ───────────────────────────────────────────────────────
-- A worker that dies between claiming and sending leaves a row stuck in
-- 'sending'. It counts against the cap forever, so the quota leaks and never
-- comes back. Returns how many it reclaimed.
create or replace function sweep_stale_claims(p_minutes integer default 10)
returns integer
language plpgsql
as $$
declare
  v_swept integer;
begin
  update outreach_messages
  set    status      = 'failed',
         error       = coalesce(error, 'claim expired — worker did not resolve it'),
         claimed_at  = null
  where  status = 'sending'
    and  claimed_at is not null
    and  claimed_at < now() - make_interval(mins => p_minutes);

  get diagnostics v_swept = row_count;
  return v_swept;
end;
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Matches the other outreach tables: the console reads as an authenticated
-- user, the pipeline uses the service role and bypasses this entirely.
alter table sending_domains enable row level security;

drop policy if exists domains_authenticated_all on sending_domains;
create policy domains_authenticated_all on sending_domains
  for all to authenticated using (true) with check (true);
