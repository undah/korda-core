// src/features/tracker/types.ts

export interface TrackerCheckin {
  id: string;
  user_id: string;
  log_date: string;       // ISO date "YYYY-MM-DD"
  weight: number;
  waist?: number | null;
  chest?: number | null;
  hips?: number | null;
  arms?: number | null;
  thighs?: number | null;
  body_fat?: number | null;
  notes?: string | null;
  created_at: string;
}

export interface TrackerGoal {
  id: string;
  user_id: string;
  start_weight?: number | null;
  goal_weight?: number | null;
  goal_waist?: number | null;
  weekly_target: number;
  created_at: string;
  updated_at: string;
}

export interface TrackerJournal {
  id: string;
  user_id: string;
  log_date: string;
  mood?: "great" | "good" | "okay" | "low" | "bad" | null;
  energy?: "high" | "medium" | "low" | null;
  sleep_hrs?: number | null;
  notes?: string | null;
  wins?: string | null;
  struggles?: string | null;
  created_at: string;
}

export interface TrackerCalories {
  id: string;
  user_id: string;
  log_date: string;
  calories_in: number;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  tdee: number;
  deficit: number;
  created_at: string;
}

export interface TrackerPhoto {
  id: string;
  user_id: string;
  log_date: string;
  angle: "front" | "side" | "back";
  url: string;
  weight_at?: number | null;
  created_at: string;
}

// Derived / computed types
export interface WeeklyAverage {
  week: string;
  avg_weight: number;
  entries: number;
}

export interface ProgressStats {
  totalLost: number;
  percentToGoal: number;
  currentStreak: number;
  avgWeeklyLoss: number;
  daysToGoal: number | null;
  bestWeek: number;
}
