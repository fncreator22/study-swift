
-- 1. Add explanation to test_questions
ALTER TABLE public.test_questions ADD COLUMN IF NOT EXISTS explanation text NOT NULL DEFAULT '';
ALTER TABLE public.test_questions ADD COLUMN IF NOT EXISTS marks integer NOT NULL DEFAULT 1;

-- 2. Videos: secure storage path + ordering + duration
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS duration_sec integer NOT NULL DEFAULT 0;
ALTER TABLE public.videos ALTER COLUMN video_url DROP NOT NULL;
ALTER TABLE public.videos ALTER COLUMN video_url SET DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_videos_course ON public.videos(course_id, position);

-- 3. Courses: optional duration
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS duration_min integer NOT NULL DEFAULT 0;

-- 4. Test attempts: published flag
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress';

-- 5. Drop and recreate secure view (questions during attempt – no answer/explanation)
DROP VIEW IF EXISTS public.test_questions_secure;
CREATE VIEW public.test_questions_secure
WITH (security_invoker=on) AS
SELECT id, test_id, question, question_type, option_a, option_b, option_c, option_d, max_words, position, marks
  FROM public.test_questions;
GRANT SELECT ON public.test_questions_secure TO authenticated;

-- 6. Update grade trigger: handle hybrid (mcq portion auto, written portion pending)
CREATE OR REPLACE FUNCTION public.grade_attempt_on_submit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_test_type text;
  v_score int := 0;
  v_total int := 0;
  v_has_written boolean := false;
BEGIN
  IF NEW.submitted_at IS NULL OR OLD.submitted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT test_type INTO v_test_type FROM public.tests WHERE id = NEW.test_id;

  SELECT COALESCE(SUM(marks),0) INTO v_total
    FROM public.test_questions q WHERE q.test_id = NEW.test_id;

  SELECT EXISTS(SELECT 1 FROM public.test_questions q
                WHERE q.test_id = NEW.test_id AND q.question_type = 'written')
    INTO v_has_written;

  -- MCQ portion auto-graded
  SELECT COALESCE(SUM(q.marks),0) INTO v_score
    FROM public.test_questions q
    JOIN public.test_answers a ON a.question_id = q.id AND a.attempt_id = NEW.id
   WHERE q.test_id = NEW.test_id
     AND q.question_type = 'mcq'
     AND a.selected_option IS NOT NULL
     AND lower(a.selected_option) = lower(q.correct_option);

  NEW.score := v_score;
  NEW.total := v_total;

  IF v_has_written OR v_test_type IN ('written','hybrid') THEN
    NEW.is_reviewed := false;
    NEW.status := 'pending_review';
  ELSE
    NEW.is_reviewed := true;
    NEW.status := 'published';
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grade_attempt_on_submit ON public.test_attempts;
CREATE TRIGGER trg_grade_attempt_on_submit
BEFORE UPDATE ON public.test_attempts
FOR EACH ROW EXECUTE FUNCTION public.grade_attempt_on_submit();

-- 7. RPC: discard previous in-progress attempt and start fresh
CREATE OR REPLACE FUNCTION public.start_fresh_attempt(_test_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_new uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_test_access(v_user, _test_id) THEN
    RAISE EXCEPTION 'No access';
  END IF;
  -- discard prior in-progress attempts (cascade answers via attempt_id)
  DELETE FROM public.test_answers WHERE attempt_id IN (
    SELECT id FROM public.test_attempts
    WHERE user_id = v_user AND test_id = _test_id AND submitted_at IS NULL
  );
  DELETE FROM public.test_attempts
    WHERE user_id = v_user AND test_id = _test_id AND submitted_at IS NULL;
  INSERT INTO public.test_attempts (user_id, test_id, status)
    VALUES (v_user, _test_id, 'in_progress')
    RETURNING id INTO v_new;
  RETURN v_new;
END;
$$;
GRANT EXECUTE ON FUNCTION public.start_fresh_attempt(uuid) TO authenticated;

-- 8. RPC: admin publishes a reviewed attempt (sets is_reviewed + published)
CREATE OR REPLACE FUNCTION public.publish_attempt(_attempt_id uuid, _score int, _total int, _feedback text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.test_attempts
     SET score = _score, total = _total, feedback = _feedback,
         is_reviewed = true, status = 'published', published_at = now()
   WHERE id = _attempt_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.publish_attempt(uuid,int,int,text) TO authenticated;

-- 9. Storage RLS for course-videos (bucket created via tool separately)
-- Allow admins to manage; block direct downloads (signed URLs only via server fn)
CREATE POLICY "course-videos admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-videos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "course-videos admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'course-videos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "course-videos admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'course-videos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "course-videos admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'course-videos' AND public.has_role(auth.uid(), 'admin'));
