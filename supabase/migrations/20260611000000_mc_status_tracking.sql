-- Add status_changed_at, interview scheduling, and offer/joining date fields
-- to mandate_candidates so pipeline tracking lives entirely on this table.

ALTER TABLE public.mandate_candidates
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS interview_date     date,
  ADD COLUMN IF NOT EXISTS interview_time     text,
  ADD COLUMN IF NOT EXISTS offer_date         date,
  ADD COLUMN IF NOT EXISTS date_of_joining    date;

-- Backfill status_changed_at for existing rows using linked_at
UPDATE public.mandate_candidates
  SET status_changed_at = COALESCE(linked_at, now())
  WHERE status_changed_at IS NULL;

-- Set default for future inserts
ALTER TABLE public.mandate_candidates
  ALTER COLUMN status_changed_at SET DEFAULT now();
