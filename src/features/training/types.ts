export type TradingSession = 'london' | 'new_york' | 'asia';

export interface TrainingEntry {
  id: string;
  tradingview_url: string;
  is_valid_setup: boolean;
  session: TradingSession | null;
  submitted_by: string | null;
  notes: string | null;
  created_at: string;
}

export type TrainingEntryInsert = Omit<TrainingEntry, 'id' | 'created_at'>;
