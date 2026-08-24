-- ============================================================
-- Korda Outreach — Gmail thread ids, for reply detection
--
-- Replies were detected by /api/outreach/inbound, a webhook Resend called after
-- receiving mail on our MX. Sending moved to the Gmail API and MX now points at
-- Google, so Resend never sees an inbound message and that endpoint is never
-- called. Reply detection — and the bounce detection built on the same handler
-- — have been silently dead ever since: a real reply lands in the Gmail inbox
-- and nothing tells the database.
--
-- The pipeline now polls Gmail instead. Matching is by thread rather than by
-- parsing In-Reply-To/References headers: Gmail already threads a reply with
-- the message it answers, so its threadId is an exact join key and needs no
-- header archaeology. That id is only knowable at send time, hence this column.
--
-- Null for anything sent before this migration, and for non-Gmail providers.
-- The poller backfills a null lazily by looking the message up once.
--
-- Idempotent: safe to run more than once.
-- Apply in: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

alter table outreach_messages
  add column if not exists provider_thread_id text;

-- The poller's hot path: given a batch of inbound thread ids, which of our
-- sent messages do they belong to.
create index if not exists messages_thread_idx
  on outreach_messages(provider_thread_id)
  where provider_thread_id is not null;
