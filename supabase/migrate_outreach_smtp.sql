-- ============================================================
-- Korda Outreach — SMTP sending identities
--
-- Resend's Acceptable Use Policy bans cold outreach outright, and the cheap
-- general-purpose mailbox hosts checked as alternatives (Migadu, Zoho) turned
-- out to ban it too — they share IP reputation across customers, so none of
-- them can permit it structurally. A real mailbox (Google Workspace /
-- Microsoft 365) sending its own mail over SMTP is the option left standing.
--
-- SMTP cannot run on Cloudflare Pages — Workers cannot open raw TCP sockets —
-- so provider = 'smtp' identities are sent from the Railway pipeline host
-- (see korda-outreach/src/send.ts), not from functions/api/outreach/send.js.
--
-- `from_email` doubles as the SMTP username (this is how Google Workspace and
-- Microsoft 365 both expect SMTP AUTH). `credential_key` — already on this
-- table — names the env var holding the mailbox's app password, exactly as it
-- does for every other provider; no secret is ever stored in this table.
--
-- Idempotent: safe to run more than once.
-- Apply in: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

alter table sending_identities
  add column if not exists smtp_host text,
  add column if not exists smtp_port integer,
  -- Null defers to "port 465 implies TLS, otherwise STARTTLS" — see
  -- smtpConfigFor in korda-outreach/src/send.ts. Only needs setting explicitly
  -- for a mailbox on a nonstandard port.
  add column if not exists smtp_secure boolean;
