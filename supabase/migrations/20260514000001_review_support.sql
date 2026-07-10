-- Add review support for written tests
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS is_reviewed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS feedback TEXT;

-- Update RLS to ensure admins can edit these
CREATE POLICY "Admins can update test attempts for grading"
ON public.test_attempts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
