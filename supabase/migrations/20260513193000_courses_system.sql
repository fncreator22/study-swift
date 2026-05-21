-- 1. Courses Table
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    thumbnail_url TEXT,
    tier test_tier NOT NULL DEFAULT 'free',
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    difficulty TEXT DEFAULT 'Beginner',
    instructor_name TEXT,
    instructor_bio TEXT,
    category TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Link Videos to Courses
ALTER TABLE public.videos ADD COLUMN course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

-- 3. Unified Access System
-- Modify purchases to support courses
ALTER TABLE public.purchases ADD COLUMN course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_user_id_test_id_key;
-- Adjust unique constraint to handle either test or course
CREATE UNIQUE INDEX purchases_user_test_idx ON public.purchases (user_id, test_id) WHERE test_id IS NOT NULL;
CREATE UNIQUE INDEX purchases_user_course_idx ON public.purchases (user_id, course_id) WHERE course_id IS NOT NULL;

-- 4. Unified Access Function
CREATE OR REPLACE FUNCTION public.has_course_access(_user_id UUID, _course_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (SELECT 1 FROM public.courses WHERE id = _course_id AND tier = 'free')
    OR EXISTS (SELECT 1 FROM public.purchases WHERE user_id = _user_id AND course_id = _course_id)
$$;

-- 5. RLS Policies
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses read all auth" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses read all anon" ON public.courses FOR SELECT TO anon USING (true);
CREATE POLICY "courses admin write" ON public.courses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Update comments to support courses
ALTER TABLE public.comments ADD COLUMN course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE public.comments ALTER COLUMN test_id DROP NOT NULL;

-- Drop old comment policy and add new unified one
DROP POLICY IF EXISTS "comments self insert" ON public.comments;
CREATE POLICY "comments self insert unified" ON public.comments FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND (
        (test_id IS NOT NULL AND public.has_test_access(auth.uid(), test_id)) OR
        (course_id IS NOT NULL AND public.has_course_access(auth.uid(), course_id))
    )
);
