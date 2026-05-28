-- Add pipeline tracking and billing fields to mandate_candidates

ALTER TABLE public.mandate_candidates
  ADD COLUMN IF NOT EXISTS stage                text,
  ADD COLUMN IF NOT EXISTS status               text,
  ADD COLUMN IF NOT EXISTS applicant_id         text,
  ADD COLUMN IF NOT EXISTS billing_value_approx numeric(12, 2),
  ADD COLUMN IF NOT EXISTS billing_value_final  numeric(12, 2);

-- Allow recruiters to update mandate_candidates only for their assigned mandates
CREATE POLICY "Recruiters can update mandate_candidates"
ON public.mandate_candidates FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'recruiter'
  )
  AND
  EXISTS (
    SELECT 1 FROM public.mandate_recruiters
    WHERE mandate_id = mandate_candidates.mandate_id
      AND recruiter_id = auth.uid()
  )
);
