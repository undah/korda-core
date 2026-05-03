import { supabase } from '@/lib/supabaseClient';
import type { ScreenshotConfig, ScreenshotLog } from '../screenshotTypes';

const RAILWAY_URL = 'https://trading-bot-production-4c10.up.railway.app';
const N8N_URL = 'https://jams883895.app.n8n.cloud/webhook/be68010d-296a-4922-ad7b-13789ee3db5b';

const DEFAULT_CONFIG: Omit<ScreenshotConfig, 'id' | 'updated_at'> = {
  enabled: false,
  schedule_mode: 'interval',
  interval_minutes: 15,
  fixed_time: null,
  days: [],
  sessions: ['always'],
  max_runs_per_day: 24,
};

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
  if (patch.id) {
    const { id, ...rest } = patch;
    const { data, error } = await supabase
      .from('screenshot_config')
      .update({ ...rest, updated_at: now })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as ScreenshotConfig;
  }
  const { data, error } = await supabase
    .from('screenshot_config')
    .insert({ ...DEFAULT_CONFIG, ...patch, updated_at: now })
    .select()
    .single();
  if (error) throw error;
  return data as ScreenshotConfig;
}

export async function fetchScreenshotLogs(limit = 50): Promise<ScreenshotLog[]> {
  const { data, error } = await supabase
    .from('screenshot_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ScreenshotLog[];
}

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

export async function triggerRunNow(): Promise<void> {
  const res = await fetch(N8N_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger: 'manual', timestamp: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
}
