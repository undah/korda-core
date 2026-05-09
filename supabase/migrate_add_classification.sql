-- Add classification column to mistakes table
ALTER TABLE public.mistakes
  ADD COLUMN IF NOT EXISTS classification TEXT
    CHECK (classification IN ('false_positive', 'false_negative', 'wrong_reasoning'));
