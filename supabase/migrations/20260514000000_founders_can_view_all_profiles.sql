-- Allow founders to read all profiles.
-- Other roles can only read their own profile.
CREATE POLICY "Founders can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'founder'
  )
);
