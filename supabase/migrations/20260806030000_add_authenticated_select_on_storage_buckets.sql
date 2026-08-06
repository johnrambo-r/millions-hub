-- Fixes "Bucket not found" (NoSuchBucket) on View Resume, introduced by
-- 20260806020000_restrict_resumes_bucket_to_authenticated.sql.
--
-- Root cause, confirmed live: storage.buckets has row-level security
-- enabled (relrowsecurity = true) with zero policies defined on it -- that
-- predates this whole change, it was never something either migration
-- touched. With RLS enabled and no policy, Postgres denies SELECT to every
-- role except the table owner/superuser by default. That was invisible
-- while the resumes bucket was public: plain object upload/download and the
-- public URL route don't need the caller's own role to see the bucket row
-- in storage.buckets to work. createSignedUrl() does -- confirmed by
-- reproducing live with `SET LOCAL ROLE authenticated; SELECT ... FROM
-- storage.buckets WHERE id = 'resumes'` returning zero rows, i.e. the
-- bucket is invisible to the very role CandidatePanel's signed-URL request
-- runs as, which is exactly "Bucket not found" from the caller's
-- perspective.
--
-- storage.objects already has correct authenticated-only INSERT/SELECT
-- policies from the prior migration; this adds the equivalent on
-- storage.buckets, scoped to just the resumes row, so authenticated
-- requests can resolve the bucket without reopening it to anon.

CREATE POLICY "Authenticated users can view resumes bucket"
  ON storage.buckets FOR SELECT
  TO authenticated
  USING (id = 'resumes');
