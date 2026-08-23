// src/features/outreach/types.ts
// Mirrors the outreach schema written by the korda-outreach pipeline.
// This app only reads/edits through the authed anon client — RLS is the guard.

export type EmailStatus = 'unverified' | 'guessed' | 'verified' | 'bounced';
export type ContactSource = 'website' | 'kvk' | 'manual' | 'email-guess' | 'osm' | 'hunter';
export type NicheProvider = 'google' | 'overpass';

export interface Niche {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  // provider/osm_filters arrived in a later migration than the original schema.
  // Rows are normalised on read (missing provider ⇒ 'google') so this console
  // still works against a database that hasn't been migrated yet.
  provider: NicheProvider;
  search_queries: string[];
  osm_filters: string[];
  location_query: string | null;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number;
  language_code: string;
  region_code: string;
  max_results: number;
  min_rating: number | null;
  min_ratings_total: number | null;
  require_website: boolean;
  require_phone: boolean;
  included_type: string | null;
  enrich_website: boolean;
  enrich_kvk: boolean;
  enrich_hunter: boolean;
  /** Null falls back to the pipeline's HUNTER_MAX_LOOKUPS_PER_RUN. */
  hunter_max_lookups: number | null;
  guess_email: boolean;
  verify_email: boolean;
  send_cap_per_day: number | null;
  recrawl_after_days: number;
}

/** Fields the UI is allowed to create/update on a niche. */
export type NicheDraft = Omit<Niche, 'id'>;

/** Cheap structural signals detected while the site was already being fetched. */
export interface SiteSignals {
  hasBooking: boolean;
  hasContactForm: boolean;
  hasSocialLinks: boolean;
  sinceYear: number | null;
}

export interface Business {
  id: string;
  niche_id: string | null;
  place_id: string;
  name: string;
  formatted_address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  domain: string | null;
  rating: number | null;
  ratings_total: number | null;
  business_status: string | null;
  primary_type: string | null;
  types: string[];
  last_enriched_at: string | null;
  discovered_at: string;
  /** Source material for AI personalization — null until a website-enrichment
   * run has crawled this business since the personalization migration. */
  site_extract: string | null;
  site_signals: SiteSignals | null;
  site_fetched_at: string | null;
}

export interface Contact {
  id: string;
  business_id: string;
  full_name: string | null;
  role: string | null;
  email: string | null;
  email_status: EmailStatus;
  source: ContactSource;
  source_url: string | null;
  confidence: number;
  legal_basis: string | null;
  do_not_contact: boolean;
  verified_at: string | null;
  created_at: string;
}

export interface SuppressionEntry {
  id: string;
  email: string | null;
  domain: string | null;
  reason: string | null;
  added_at: string;
}

export interface RunLogEntry {
  id: string;
  niche_id: string | null;
  started_at: string;
  finished_at: string | null;
  discovered: number | null;
  enriched: number | null;
  contacts_new: number | null;
  error: string | null;
}

/** The read-only handoff view — already filtered for suppression/bounces/DNC. */
export interface OutreachReadyRow {
  contact_id: string;
  business_id: string;
  niche: string | null;
  business_name: string;
  website: string | null;
  domain: string | null;
  formatted_address: string | null;
  phone: string | null;
  rating: number | null;
  ratings_total: number | null;
  full_name: string | null;
  role: string | null;
  email: string;
  email_status: EmailStatus;
  source: ContactSource;
  source_url: string | null;
  confidence: number;
  last_contacted_at: string | null;
}

// ── email manager ─────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'paused';
export type MessageStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'skipped' | 'canceled';

/** What a generated email is trying to do — chosen before generation, not after. */
export type Objective = 'reply' | 'book_call' | 'sale' | 'warm_up';
export type PersonalizeMode = 'off' | 'full';

export const OBJECTIVE_LABELS: Record<Objective, string> = {
  reply: 'Get a reply',
  book_call: 'Book a call',
  sale: 'Move toward a sale',
  warm_up: 'Warm up a cold lead',
};

/**
 * What we sell, stated once rather than retyped into every generation. Edited
 * on the Settings page; read by the pipeline host when it calls Claude.
 */
export interface OutreachProfile {
  id: string;
  company_name: string;
  offer: string;
  proof_points: string;
  tone: string;
  language: string;
  sender_name: string;
  constraints: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  template_id: string | null;
  status: CampaignStatus;
  objective: Objective;
  objective_notes: string | null;
  personalize: PersonalizeMode;
  created_at: string;
  updated_at: string;
}

/** One step of a campaign's follow-up sequence. Step 1 is the initial mail. */
export interface SequenceStep {
  id: string;
  campaign_id: string;
  step_number: number;
  template_id: string | null;
  /** Days after the previous step actually sent. Always 0 for step 1. */
  delay_days: number;
  created_at: string;
}

/** A step as edited in the campaign builder, before it has an id. */
export interface SequenceStepDraft {
  template_id: string;
  delay_days: number;
}

export interface OutreachMessage {
  id: string;
  campaign_id: string;
  contact_id: string;
  to_email: string;
  subject: string;
  body: string;
  status: MessageStatus;
  step_number: number;
  niche_id: string | null;
  skip_reason: string | null;
  error: string | null;
  provider_message_id: string | null;
  /** Null means a later step whose turn has not come yet. */
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  /** Null inherits the campaign's objective — the normal case except for an
   * individually-sent message, which has no campaign default to fall back to. */
  objective: Objective | null;
  personalized: boolean;
  personalization_error: string | null;
  personalization_model: string | null;
}

/**
 * One mailbox in the sending pool.
 *
 * `credential_key` names an environment variable on the host — it is never the
 * credential itself, which is why this table is safe to read from the browser.
 */
export interface SendingIdentity {
  id: string;
  label: string;
  from_email: string;
  from_name: string | null;
  reply_to: string | null;
  provider: string;
  credential_key: string;
  daily_cap: number;
  /** Null means no ramp — only for a mailbox with existing reputation. */
  warmup_started_on: string | null;
  active: boolean;
  /** Only used when provider is "smtp" — from_email doubles as the SMTP
   * username, credential_key still names the env var holding the app password. */
  smtp_host: string | null;
  smtp_port: number | null;
  /** Null defers to "port 465 implies TLS, otherwise STARTTLS". */
  smtp_secure: boolean | null;
  created_at: string;
  updated_at: string;
}

export type SendingIdentityDraft = Omit<
  SendingIdentity, 'id' | 'created_at' | 'updated_at'
>;

/** What /api/outreach/send reports back per batch. */
export interface SendResult {
  sent: number;
  skipped: number;
  failed: number;
  remaining: number;
  done: boolean;
}

export interface LeadsFilter {
  niche?: string;
  minConfidence?: number;
  emailStatus?: EmailStatus;
  search?: string;
  page?: number;
}

export const LEADS_PAGE_SIZE = 50;

/**
 * At or below this many recipients, a campaign generates every email upfront
 * so each one can be read and edited before sending. Above it, generation
 * happens at send time (the scheduler calls Claude just before each message
 * goes out) and the builder shows one preview instead of the full set —
 * generating hundreds of emails synchronously in the browser doesn't scale,
 * and most of that spend would be wasted on recipients later skipped by
 * suppression or a reply.
 */
export const PERSONALIZE_UPFRONT_MAX = 50;
