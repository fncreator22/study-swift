
-- =========================================================
-- PHASE 1: DATABASE FOUNDATION (non-destructive)
-- =========================================================

-- 0) Drop old rankings_view so we can rebuild with the new column set
DROP VIEW IF EXISTS public.rankings_view CASCADE;

-- 1) Add missing columns to existing tables ---------------
ALTER TABLE public.profiles      ADD COLUMN IF NOT EXISTS tokens integer NOT NULL DEFAULT 0;
ALTER TABLE public.tests         ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS feedback text;
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS is_reviewed boolean NOT NULL DEFAULT false;

-- 2) Create courses ---------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  thumbnail_url text NOT NULL DEFAULT '',
  tier text NOT NULL DEFAULT 'free',
  price numeric NOT NULL DEFAULT 0,
  difficulty text NOT NULL DEFAULT 'Beginner',
  instructor_name text NOT NULL DEFAULT '',
  instructor_bio text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Professional',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "courses read all" ON public.courses;
DROP POLICY IF EXISTS "courses admin write" ON public.courses;
CREATE POLICY "courses read all" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses admin write" ON public.courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Link purchases / comments / videos to courses --------
ALTER TABLE public.purchases ALTER COLUMN test_id DROP NOT NULL;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchases_test_or_course') THEN
    ALTER TABLE public.purchases ADD CONSTRAINT purchases_test_or_course
      CHECK ((test_id IS NOT NULL)::int + (course_id IS NOT NULL)::int = 1) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.comments  ALTER COLUMN test_id DROP NOT NULL;
ALTER TABLE public.comments  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

ALTER TABLE public.videos    ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

-- 4) wallet_transactions ----------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text NOT NULL DEFAULT 'adjust',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet self read"   ON public.wallet_transactions;
DROP POLICY IF EXISTS "wallet self insert" ON public.wallet_transactions;
DROP POLICY IF EXISTS "wallet admin all"   ON public.wallet_transactions;
CREATE POLICY "wallet self read" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wallet self insert" ON public.wallet_transactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wallet admin all" ON public.wallet_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) token_requests ---------------------------------------
CREATE TABLE IF NOT EXISTS public.token_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  screenshot_url text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.token_requests TO authenticated;
GRANT ALL ON public.token_requests TO service_role;
ALTER TABLE public.token_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "token_requests self read"   ON public.token_requests;
DROP POLICY IF EXISTS "token_requests self insert" ON public.token_requests;
DROP POLICY IF EXISTS "token_requests admin all"   ON public.token_requests;
CREATE POLICY "token_requests self read" ON public.token_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "token_requests self insert" ON public.token_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "token_requests admin all" ON public.token_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6) test_reviews (placeholder for per-question notes) ----
CREATE TABLE IF NOT EXISTS public.test_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.test_questions(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_reviews TO authenticated;
GRANT ALL ON public.test_reviews TO service_role;
ALTER TABLE public.test_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews owner or admin read" ON public.test_reviews;
DROP POLICY IF EXISTS "reviews admin write"         ON public.test_reviews;
CREATE POLICY "reviews owner or admin read" ON public.test_reviews FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid())
  );
CREATE POLICY "reviews admin write" ON public.test_reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7) memberships ------------------------------------------
CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memberships self read"   ON public.memberships;
DROP POLICY IF EXISTS "memberships admin write" ON public.memberships;
CREATE POLICY "memberships self read" ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "memberships admin write" ON public.memberships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8) settings ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings read all"    ON public.settings;
DROP POLICY IF EXISTS "settings admin write" ON public.settings;
CREATE POLICY "settings read all" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin write" ON public.settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 9) rankings_view ----------------------------------------
CREATE VIEW public.rankings_view
WITH (security_invoker = true) AS
SELECT
  p.id            AS user_id,
  p.full_name,
  p.college,
  COALESCE(SUM(a.score), 0)::int AS total_score,
  COUNT(a.id)::int               AS tests_taken
FROM public.profiles p
LEFT JOIN public.test_attempts a
  ON a.user_id = p.id AND a.submitted_at IS NOT NULL
GROUP BY p.id, p.full_name, p.college;
GRANT SELECT ON public.rankings_view TO authenticated;

-- 10) Indexes ---------------------------------------------
CREATE INDEX IF NOT EXISTS idx_test_attempts_user        ON public.test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_test        ON public.test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_test_questions_test       ON public.test_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_answers_attempt      ON public.test_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user            ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_test            ON public.purchases(test_id);
CREATE INDEX IF NOT EXISTS idx_purchases_course          ON public.purchases(course_id);
CREATE INDEX IF NOT EXISTS idx_comments_course           ON public.comments(course_id);
CREATE INDEX IF NOT EXISTS idx_comments_test             ON public.comments(test_id);
CREATE INDEX IF NOT EXISTS idx_videos_course             ON public.videos(course_id);
CREATE INDEX IF NOT EXISTS idx_wallet_user               ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_requests_user       ON public.token_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_token_requests_status     ON public.token_requests(status);
CREATE INDEX IF NOT EXISTS idx_memberships_user          ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_test_reviews_attempt      ON public.test_reviews(attempt_id);

-- 11) Storage bucket for payment screenshots --------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('payments', 'payments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "payments user upload"   ON storage.objects;
DROP POLICY IF EXISTS "payments public read"   ON storage.objects;
DROP POLICY IF EXISTS "payments owner update"  ON storage.objects;
DROP POLICY IF EXISTS "payments owner delete"  ON storage.objects;
CREATE POLICY "payments user upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "payments public read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'payments');
CREATE POLICY "payments owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'payments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "payments owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payments' AND auth.uid()::text = (storage.foldername(name))[1]);
