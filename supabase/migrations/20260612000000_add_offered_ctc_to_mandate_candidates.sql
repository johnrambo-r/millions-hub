-- Add offered_ctc to capture the salary offered to the candidate,
-- separate from billing_value_approx (the recruiter fee billed to the client).

ALTER TABLE public.mandate_candidates
  ADD COLUMN IF NOT EXISTS offered_ctc numeric(14, 2);
