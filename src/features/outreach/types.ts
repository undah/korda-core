// src/features/outreach/types.ts
// Mirrors the outreach schema written by the korda-outreach pipeline.
// This app only reads/edits through the authed anon client — RLS is the guard.

export type EmailStatus = 'unverified' | 'guessed' | 'verified' | 'bounced';
export type ContactSource = 'website' | 'kvk' | 'manual' | 'email-guess' | 'osm';
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
  guess_email: boolean;
  verify_email: boolean;
  send_cap_per_day: number | null;
  recrawl_after_days: number;
}

/** Fields the UI is allowed to create/update on a niche. */
export type NicheDraft = Omit<Niche, 'id'>;

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
  created_at: string;
  updated_at: string;
}

export interface OutreachMessage {
  id: string;
  campaign_id: string;
  contact_id: string;
  to_email: string;
  subject: string;
  body: string;
  status: MessageStatus;
  skip_reason: string | null;
  error: string | null;
  provider_message_id: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

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
