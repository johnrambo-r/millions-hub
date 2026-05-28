-- ─────────────────────────────────────────────
-- MANDATES MODULE
-- Tables: mandates, mandate_recruiters, mandate_candidates
-- ─────────────────────────────────────────────

-- ── mandates ────────────────────────────────────────────────────────────────

CREATE TABLE public.mandates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text        NOT NULL,
  client_id        uuid        NOT NULL REFERENCES public.clients(id),
  am_id            uuid        NOT NULL REFERENCES public.profiles(id),
  status           text        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'on_hold', 'closed', 'cancelled')),
  priority         text        DEFAULT 'medium'
                               CHECK (priority IN ('low', 'medium', 'high')),
  num_positions    integer     DEFAULT 1,
  experience_min   numeric,
  experience_max   numeric,
  location         text,
  work_mode        text        CHECK (work_mode IN ('onsite', 'hybrid', 'remote')),
  employment_type  text        CHECK (employment_type IN ('full_time', 'contract', 'contract_to_hire')),
  budget_min       numeric,
  budget_max       numeric,
  budget_currency  text        DEFAULT 'INR',
  jd_text          text,
  jd_file_url      text,
  internal_notes   text,
  created_by       uuid        REFERENCES public.profiles(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ── mandate_recruiters ───────────────────────────────────────────────────────

CREATE TABLE public.mandate_recruiters (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id    uuid        NOT NULL REFERENCES public.mandates(id) ON DELETE CASCADE,
  recruiter_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at   timestamptz DEFAULT now(),
  UNIQUE (mandate_id, recruiter_id)
);

-- ── mandate_candidates ───────────────────────────────────────────────────────

CREATE TABLE public.mandate_candidates (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id            uuid        NOT NULL REFERENCES public.mandates(id) ON DELETE CASCADE,
  candidate_id          text        NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  linked_by             uuid        REFERENCES public.profiles(id),
  linked_at             timestamptz DEFAULT now(),
  submitted_to_client   boolean     DEFAULT false,
  submitted_at          timestamptz,
  client_response       text        CHECK (client_response IN ('shortlisted', 'rejected', 'on_hold')),
  client_response_at    timestamptz,
  notes                 text,
  UNIQUE (mandate_id, candidate_id)
);

-- ─────────────────────────────────────────────
-- updated_at TRIGGER
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_mandates_updated_at
  BEFORE UPDATE ON public.mandates
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

ALTER TABLE public.mandates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandate_recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandate_candidates ENABLE ROW LEVEL SECURITY;

-- ── mandates: SELECT ─────────────────────────────────────────────────────────

CREATE POLICY "Founders can read all mandates"
ON public.mandates FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'founder')
);

CREATE POLICY "AMs can read all mandates"
ON public.mandates FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'account_manager')
);

CREATE POLICY "Recruiters can read assigned mandates"
ON public.mandates FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.mandate_recruiters
    WHERE mandate_id = mandates.id AND recruiter_id = auth.uid()
  )
);

-- ── mandates: INSERT ─────────────────────────────────────────────────────────

CREATE POLICY "Founders can insert mandates"
ON public.mandates FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'founder')
);

-- ── mandates: UPDATE ─────────────────────────────────────────────────────────

CREATE POLICY "Founders can update all mandates"
ON public.mandates FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'founder')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'founder')
);

CREATE POLICY "AMs can update their own mandates"
ON public.mandates FOR UPDATE TO authenticated
USING (
  am_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'account_manager')
)
WITH CHECK (
  am_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'account_manager')
);

-- ── mandates: DELETE ─────────────────────────────────────────────────────────

CREATE POLICY "Founders can delete mandates"
ON public.mandates FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'founder')
);

-- ── mandate_recruiters: SELECT ───────────────────────────────────────────────

CREATE POLICY "Authenticated users can read mandate_recruiters"
ON public.mandate_recruiters FOR SELECT TO authenticated
USING (true);

-- ── mandate_recruiters: INSERT ───────────────────────────────────────────────

CREATE POLICY "Founders and AMs can insert mandate_recruiters"
ON public.mandate_recruiters FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('founder', 'account_manager')
  )
);

-- ── mandate_recruiters: DELETE ───────────────────────────────────────────────

CREATE POLICY "Founders and AMs can delete mandate_recruiters"
ON public.mandate_recruiters FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('founder', 'account_manager')
  )
);

-- ── mandate_candidates: SELECT ───────────────────────────────────────────────

CREATE POLICY "Authenticated users can read mandate_candidates"
ON public.mandate_candidates FOR SELECT TO authenticated
USING (true);

-- ── mandate_candidates: INSERT ───────────────────────────────────────────────

CREATE POLICY "Founders and AMs can insert mandate_candidates"
ON public.mandate_candidates FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('founder', 'account_manager')
  )
);

-- ── mandate_candidates: UPDATE ───────────────────────────────────────────────

CREATE POLICY "Founders and AMs can update mandate_candidates"
ON public.mandate_candidates FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('founder', 'account_manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('founder', 'account_manager')
  )
);

-- ── mandate_candidates: DELETE ───────────────────────────────────────────────

CREATE POLICY "Founders and AMs can delete mandate_candidates"
ON public.mandate_candidates FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('founder', 'account_manager')
  )
);
