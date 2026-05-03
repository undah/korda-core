export type ScheduleMode = 'interval' | 'fixed';
export type SessionFilter = 'always' | 'london' | 'new_york';
export type LogStatus = 'success' | 'error' | 'skipped';

export interface ScreenshotConfig {
  id: string;
  enabled: boolean;
  schedule_mode: ScheduleMode;
  interval_minutes: number | null;
  fixed_time: string | null;
  days: string[];
  sessions: SessionFilter[];
  pairs: string[];
  max_runs_per_day: number;
  updated_at: string;
}

export interface ScreenshotLog {
  id: string;
  status: LogStatus;
  timestamp: string;
  image_base64: string | null;
  reason: string | null;
  created_at: string;
}
