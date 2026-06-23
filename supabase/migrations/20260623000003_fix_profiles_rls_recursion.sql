-- Fix: infinite recursion in profiles RLS policies.
--
-- Root cause: the INSERT, UPDATE, DELETE, and a SELECT policy on profiles all
-- contained subqueries that SELECT from profiles itself. PostgreSQL re-evaluates
-- RLS on every table access, including sub-selects, so these policies triggered
-- themselves indefinitely.
--
-- Fix: introduce a SECURITY DEFINER function that reads the caller's role without
-- going through RLS (it executes as the function owner, bypassing row security).
-- All four recursive policies are replaced with calls to this function.
-- The redundant "Founders can view all profiles" SELECT policy is dropped — it
-- duplicated the existing "Authenticated users can read profiles" (true) policy.

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "Founders can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Founders can insert profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Founders can update profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Founders can delete profiles"   ON public.profiles;

CREATE POLICY "Founders can insert profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.get_auth_user_role() = 'founder');

CREATE POLICY "Founders can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING     (public.get_auth_user_role() = 'founder')
  WITH CHECK (public.get_auth_user_role() = 'founder');

CREATE POLICY "Founders can delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.get_auth_user_role() = 'founder');
