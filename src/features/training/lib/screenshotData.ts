import { supabase } from '@/lib/supabaseClient';
import type { ScreenshotConfig, ScreenshotLog } from '../screenshotTypes';

const RAILWAY_URL = 'https://trading-bot-production-4c10.up.railway.app';

const DEFAULT_CONFIG: Omit<ScreenshotConfig, 'id' | 'updated_at'> = {
  enabled: false,
  schedule_mode: 'interval',
  interval_minutes: 15,
  fixed_time: null,
  days: [],
  sessions: ['always'],
  pairs: ['EURUSD'],
  max_runs_per_day: 24,
};

// ── Supabase ──────────────────────────────────────────────────────────────────

export async function fetchScreenshotConfig(): Promise<ScreenshotConfig | null> {
  const { data, error } = await supabase
    .from('screenshot_config')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ScreenshotConfig | null;
}

export async function saveScreenshotConfig(
  patch: Partial<ScreenshotConfig> & { id?: string }
): Promise<ScreenshotConfig> {
  const now = new Date().toISOString();
  let saved: ScreenshotConfig;

  if (patch.id) {
    const { id, ...rest } = patch;
    const { data, error } = await supabase
      .from('screenshot_config')
      .update({ ...rest, updated_at: now })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    saved = data as ScreenshotConfig;
  } else {
    const { data, error } = await supabase
      .from('screenshot_config')
      .insert({ ...DEFAULT_CONFIG, ...patch, updated_at: now })
      .select()
      .single();
    if (error) throw error;
    saved = data as ScreenshotConfig;
  }

  // Sync to Railway (non-blocking — don't fail if bot is temporarily down)
  syncScheduleToRailway(saved).catch(err =>
    console.warn('[Railway sync]', err?.message ?? err)
  );

  return saved;
}

export async function fetchScreenshotLogs(limit = 50): Promise<ScreenshotLog[]> {
  const { data, error } = await supabase
    .from('screenshot_log')
    .select('id, status, timestamp, image_base64, reason, created_at, ai_validation, ai_reasoning')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ScreenshotLog[];
}

// ── Railway ───────────────────────────────────────────────────────────────────

export async function checkServiceHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${RAILWAY_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchScheduleStatus(): Promise<{ next_run: string | null; enabled: boolean }> {
  const res = await fetch(`${RAILWAY_URL}/schedule`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function syncScheduleToRailway(config: ScreenshotConfig): Promise<void> {
  const res = await fetch(`${RAILWAY_URL}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enabled:          config.enabled,
      schedule_mode:    config.schedule_mode,
      interval_minutes: config.interval_minutes,
      fixed_time:       config.fixed_time,
      days:             config.days,
      sessions:         config.sessions,
      pairs:            config.pairs,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }
}

export async function triggerRunNow(): Promise<void> {
  const res = await fetch(`${RAILWAY_URL}/run-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  const failed = (data.results ?? []).filter((r: any) => r.status === 'error');
  if (failed.length > 0 && failed.length < (data.results ?? []).length) {
    console.warn('[Run Now] some pairs failed:', failed);
  }
}
