-- ============================================================
-- Korda Outreach — Email Manager (one-shot sends)
--
-- Adds templates, campaigns, and an outbox on top of the existing outreach
-- schema. Sending itself happens server-side in a Cloudflare function with the
-- service-role key; this app only reads/queues through the authed anon client.
--
-- The existing pieces this leans on (already applied, do not recreate):
--   • outreach_events        — sent/opened/clicked/replied/bounced/unsubscribed
--   • handle_optout trigger  — auto-suppresses on bounce/unsubscribe
--   • outreach_ready view    — already excludes suppressed / bounced / DNC
--
-- Idempotent: safe to run more than once.
-- Apply in: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ── templates ────────────────────────────────────────────────────────────────
-- Body/subject support merge fields rendered at queue time:
--   {{first_name}} {{full_name}} {{business_name}} {{domain}} {{city}}
create table if not exists email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  subject     text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── campaigns ────────────────────────────────────────────────────────────────
-- A named batch of one-shot sends. Sequences are deliberately out of scope.
create table if not exists campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  template_id  uuid references email_templates(id) on delete set null,
  status       text not null default 'draft'
               check (status in ('draft','sending','sent','paused')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists campaigns_created_idx on campaigns(created_at desc);

-- ── outbox ───────────────────────────────────────────────────────────────────
-- One row per recipient per campaign. Rendered at queue time so what you
-- previewed is exactly what goes out, even if the template changes later.
create table if not exists outreach_messages (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references campaigns(id) on delete cascade,
  contact_id          uuid not null references contacts(id) on delete cascade,
  to_email            text not null,
  subject             text not null,
  body                text not null,
  status              text not null default 'queued'
                      check (status in ('queued','sending','sent','failed','skipped','canceled')),
  skip_reason         text,
  error               text,
  provider_message_id text,
  -- Per-message token so an unsubscribe link identifies the contact without
  -- exposing any internal id.
  unsubscribe_token   uuid not null default gen_random_uuid(),
  scheduled_at        timestamptz,
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  unique (campaign_id, contact_id)
);

create index if not exists messages_campaign_idx    on outreach_messages(campaign_id);
create index if not exists messages_status_idx      on outreach_messages(status);
create index if not exists messages_contact_idx     on outreach_messages(contact_id);
create unique index if not exists messages_unsub_idx on outreach_messages(unsubscribe_token);
create index if not exists messages_provider_idx    on outreach_messages(provider_message_id)
  where provider_message_id is not null;

-- ── updated_at triggers (set_updated_at already exists) ──────────────────────
drop trigger if exists trg_templates_updated on email_templates;
create trigger trg_templates_updated before update on email_templates
  for each row execute function set_updated_at();

drop trigger if exists trg_campaigns_updated on campaigns;
create trigger trg_campaigns_updated before update on campaigns
  for each row execute function set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Mirrors the suite RLS patch: signed-in users manage these from the console;
-- the Cloudflare send/webhook functions use the service-role key and bypass RLS.
alter table email_templates    enable row level security;
alter table campaigns          enable row level security;
alter table outreach_messages  enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'email_templates' and policyname = 'templates_authenticated_all') then
    create policy templates_authenticated_all on email_templates
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'campaigns' and policyname = 'campaigns_authenticated_all') then
    create policy campaigns_authenticated_all on campaigns
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'outreach_messages' and policyname = 'messages_authenticated_all') then
    create policy messages_authenticated_all on outreach_messages
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ── seed: one starter template so the UI isn't empty on first open ───────────
insert into email_templates (name, subject, body)
select
  'Intro — short',
  'Quick question about {{business_name}}',
  E'Hi {{first_name}},\n\nI came across {{business_name}} and had a quick question — are you currently taking on new clients?\n\nI help local businesses like yours pick up more enquiries without adding admin work. If that''s useful I can send over a short example, no obligation.\n\nWorth a look?\n\nBest,\nG'
where not exists (select 1 from email_templates);
