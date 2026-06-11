
ALTER TABLE public.test_answers
  ADD COLUMN IF NOT EXISTS marks_awarded numeric,
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.test_questions
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

-- Admin saves per-question marks/feedback (draft); idempotent upsert
CREATE OR REPLACE FUNCTION public.save_review_answer(
  _attempt_id uuid,
  _question_id uuid,
  _marks numeric,
  _feedback text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.test_answers (attempt_id, question_id, marks_awarded, feedback, reviewed_by, reviewed_at)
  VALUES (_attempt_id, _question_id, _marks, _feedback, v_admin, now())
  ON CONFLICT (attempt_id, question_id) DO UPDATE
    SET marks_awarded = EXCLUDED.marks_awarded,
        feedback = EXCLUDED.feedback,
        reviewed_by = EXCLUDED.reviewed_by,
        reviewed_at = EXCLUDED.reviewed_at;
END;
$$;

-- Updated publish: sum per-question marks; allow optional override
CREATE OR REPLACE FUNCTION public.publish_attempt(
  _attempt_id uuid,
  _score integer,
  _total integer,
  _feedback text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_score numeric;
  v_total numeric;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- If caller passes 0/null score/total, derive from per-question grading
  SELECT
    COALESCE(SUM(COALESCE(a.marks_awarded, 0)), 0),
    COALESCE(SUM(q.marks), 0)
  INTO v_score, v_total
  FROM public.test_attempts att
  JOIN public.test_questions q ON q.test_id = att.test_id
  LEFT JOIN public.test_answers a
    ON a.attempt_id = att.id AND a.question_id = q.id
  WHERE att.id = _attempt_id;

  UPDATE public.test_attempts
     SET score = COALESCE(NULLIF(_score, 0), v_score::int),
         total = COALESCE(NULLIF(_total, 0), v_total::int),
         feedback = _feedback,
         is_reviewed = true,
         status = 'published',
         published_at = now(),
         reviewed_by = v_admin
   WHERE id = _attempt_id;
END;
$$;
