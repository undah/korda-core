-- Add fat_mass_kg and lean_mass_kg as STORED generated columns to tracker_checkins.
-- The source columns (weight, body_fat) already exist. NULL body_fat rows produce NULL
-- generated values via normal NULL arithmetic — they simply won't plot on the chart.
-- Existing RLS policies are row-level and cover all columns automatically.

ALTER TABLE public.tracker_checkins
  ADD COLUMN IF NOT EXISTS fat_mass_kg  numeric(6,2)
    GENERATED ALWAYS AS (weight * body_fat / 100.0) STORED,
  ADD COLUMN IF NOT EXISTS lean_mass_kg numeric(6,2)
    GENERATED ALWAYS AS (weight * (1.0 - body_fat / 100.0)) STORED;
