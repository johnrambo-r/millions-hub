-- The resumes bucket was found to be doubly open while investigating the
-- resume-upload race condition fixed earlier the same day:
--   - storage.buckets.public = true, so every object was servable to anyone
--     via the /storage/v1/object/public/resumes/... route regardless of any
--     RLS policy on storage.objects (Supabase's public-bucket route bypasses
--     RLS by design).
--   - The INSERT policy ("Allow public uploads") had no auth check at all
--     (`with_check: bucket_id = 'resumes'`), so even the RLS-gated upload
--     path accepted unauthenticated requests.
--   - The SELECT policy ("Allow public reads") was equally open
--     (`qual: bucket_id = 'resumes'`), redundant with the bucket-level flag
--     but confirming reads were never restricted either.
--
-- This migration closes both: the bucket becomes private, and INSERT/SELECT
-- are restricted to the `authenticated` Postgres role (i.e. a logged-in Hub
-- user), matching how every other write path in this app is gated.
--
-- Because the bucket is no longer public, resumes can't be opened via a
-- permanently-fetchable stored URL any more -- CandidatePanel.jsx was
-- changed in the same commit to mint a short-lived createSignedUrl() on
-- click instead of linking straight to candidate.resume_url. That call
-- itself requires the SELECT policy below to succeed, so this migration and
-- that code change are dependent on each other and must ship together.
--
-- UPDATE/DELETE were already ungoverned (no policy existed for either, so
-- both were already implicitly denied under RLS's default-deny) and are
-- left untouched here -- out of scope for this pass, tracked separately.

UPDATE storage.buckets SET public = false WHERE id = 'resumes';

DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
CREATE POLICY "Authenticated users can upload resumes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'resumes');

DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
CREATE POLICY "Authenticated users can read resumes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'resumes');
