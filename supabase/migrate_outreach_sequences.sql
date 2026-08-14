-- ============================================================
-- Korda Outreach — follow-up sequences
--
-- A campaign could only ever send one email per lead. Most replies to cold
-- outreach come from follow-ups rather than the first touch, so this adds the
-- steps behind a campaign and lets one contact hold several queued messages.
--
-- The load-bearing change is the unique key on outreach_messages: it was
-- (campaign_id, contact_id), which made a second message to the same person
-- physically impossible to insert. It becomes (campaign_id, contact_id,
-- step_number), so a contact can hold one message per step and no more.
--
-- Idempotent: safe to run more than once.
-- Apply in: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

-- ── the steps behind a campaign ──────────────────────────────────────────────
-- Step 1 is the initial mail and is always delay_days = 0. Later steps are
-- measured from when the previous step actually sent, not from campaign start,
-- so a paced campaign keeps its spacing.
create table if not exists sequence_steps (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  step_number integer not null check (step_number >= 1),
  template_id uuid references email_templates(id) on delete restrict,
  delay_days  integer not null default 0 check (delay_days >= 0),
  created_at  timestamptz not null default now(),
  unique (campaign_id, step_number)
);

create index if not exists sequence_steps_campaign_idx
  on sequence_steps(campaign_id, step_number);

-- ── outreach_messages gains a step, and its niche ────────────────────────────
-- niche_id is denormalised purely so the per-niche daily cap is one indexed
-- count instead of a messages -> contacts -> businesses -> niches join on every
-- single send.
alter table outreach_messages
  add column if not exists step_number integer not null default 1,
  add column if not exists niche_id uuid references niches(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'outreach_messages_step_number_check'
  ) then
    alter table outreach_messages
      add constraint outreach_messages_step_number_check check (step_number >= 1);
  end if;
end $$;

-- Backfill the niche for messages queued before this column existed, so the
-- per-niche cap counts history correctly rather than treating it as unassigned.
update outreach_messages m
set niche_id = b.niche_id
from contacts c
join businesses b on b.id = c.business_id
where m.contact_id = c.id
  and m.niche_id is null;

-- ── swap the unique key ──────────────────────────────────────────────────────
-- Found by shape rather than by name: the original was created inline in
-- `create table`, so its generated name is an implementation detail we should
-- not depend on.
do $$
declare
  v_name text;
begin
  select con.conname into v_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'outreach_messages'
    and con.contype = 'u'
    and (
      select array_agg(att.attname order by att.attname)
      from unnest(con.conkey) as k(attnum)
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
    ) = array['campaign_id', 'contact_id']
  limit 1;

  if v_name is not null then
    execute format('alter table outreach_messages drop constraint %I', v_name);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'outreach_messages_campaign_contact_step_key'
  ) then
    alter table outreach_messages
      add constraint outreach_messages_campaign_contact_step_key
      unique (campaign_id, contact_id, step_number);
  end if;
end $$;

-- Due-work lookup: the sender asks for queued messages whose scheduled_at has
-- passed, on every tick.
create index if not exists messages_due_idx
  on outreach_messages(scheduled_at)
  where status = 'queued';

create index if not exists messages_niche_sent_idx
  on outreach_messages(niche_id, sent_at)
  where status = 'sent';

-- ── existing campaigns get an implicit step 1 ────────────────────────────────
-- Campaigns created before sequences existed already have their step-1 messages
-- queued; giving them a matching sequence_steps row keeps every campaign
-- readable through the same shape.
insert into sequence_steps (campaign_id, step_number, template_id, delay_days)
select c.id, 1, c.template_id, 0
from campaigns c
where not exists (
  select 1 from sequence_steps s where s.campaign_id = c.id and s.step_number = 1
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table sequence_steps enable row level security;

drop policy if exists "authenticated manages sequence_steps" on sequence_steps;
create policy "authenticated manages sequence_steps" on sequence_steps
  for all to authenticated using (true) with check (true);
