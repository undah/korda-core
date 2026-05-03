export interface TrainingEntry {
  id: string;
  screenshot_url: string | null;
  tradingview_url: string;
  is_valid_setup: boolean;
  notes: string | null;
  created_at: string;
}

export type TrainingEntryInsert = Omit<TrainingEntry, 'id' | 'created_at'>;
