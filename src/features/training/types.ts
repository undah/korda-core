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

export interface Mistake {
  id: string;
  screenshot_url: string;
  mistake: string;
  reason: string | null;
  created_at: string;
}
export type MistakeInsert = Omit<Mistake, 'id' | 'created_at'>;

export interface ConceptEntry {
  id: string;
  concept: string;
  explanation: string;
  example_url: string | null;
  notes: string | null;
  submitted_by: string | null;
  created_at: string;
}
export type ConceptEntryInsert = Omit<ConceptEntry, 'id' | 'created_at'>;

export interface ConceptExample {
  id: string;
  concept_id: string;
  url: string | null;
  notes: string | null;
  example_type: string | null;
  created_at: string;
}
export type ConceptExampleInsert = Omit<ConceptExample, 'id' | 'created_at'>;

export type RuleCategory = 'entry' | 'exit' | 'risk' | 'psychology' | 'setup' | 'other';

export interface StrategyRule {
  id: string;
  title: string;
  category: RuleCategory;
  description: string;
  example_url: string | null;
  active: boolean;
  created_at: string;
}
export type StrategyRuleInsert = Omit<StrategyRule, 'id' | 'created_at'>;
