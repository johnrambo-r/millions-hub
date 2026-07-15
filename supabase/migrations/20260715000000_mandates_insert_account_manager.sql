-- Allow account_manager (in addition to founder) to insert mandates.
--
-- "Founders can insert mandates" (20260528000000_add_mandates_module.sql) was the
-- only INSERT policy on mandates and only ever allowed role = 'founder'. That was a
-- gap in the original migration, not a regression: the same migration granted AMs
-- SELECT and "update their own" access but never INSERT. recruiter stays excluded,
-- matching the intended access model (mandate creation: founder + account_manager only).
--
-- Also switches from the inline `EXISTS (SELECT ... FROM profiles ...)` subquery to
-- get_auth_user_role(), matching the pattern established in
-- 20260623000003_fix_profiles_rls_recursion.sql (a SECURITY DEFINER function that
-- reads the caller's role without going through RLS, avoiding the recursion risk
-- that pattern was built to prevent).
--
-- SELECT and UPDATE policies on mandates are untouched -- they are already correct.

DROP POLICY IF EXISTS "Founders can insert mandates" ON public.mandates;

CREATE POLICY "Founders and AMs can insert mandates"
ON public.mandates FOR INSERT TO authenticated
WITH CHECK (
  public.get_auth_user_role() IN ('founder', 'account_manager')
);
