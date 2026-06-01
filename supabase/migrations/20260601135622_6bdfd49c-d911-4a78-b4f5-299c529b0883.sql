
-- A) Expand rankings_view with attempts_count + avg_percentage ------
DROP VIEW IF EXISTS public.rankings_view CASCADE;
CREATE VIEW public.rankings_view
WITH (security_invoker = true) AS
SELECT
  p.id            AS user_id,
  p.full_name,
  p.college,
  COALESCE(SUM(a.score), 0)::int                                            AS total_score,
  COUNT(a.id)::int                                                          AS tests_taken,
  COUNT(a.id)::int                                                          AS attempts_count,
  CASE
    WHEN COALESCE(SUM(a.total), 0) = 0 THEN 0
    ELSE ROUND(SUM(a.score)::numeric / NULLIF(SUM(a.total), 0) * 100, 2)
  END::numeric                                                              AS avg_percentage
FROM public.profiles p
LEFT JOIN public.test_attempts a
  ON a.user_id = p.id AND a.submitted_at IS NOT NULL
GROUP BY p.id, p.full_name, p.college;
GRANT SELECT ON public.rankings_view TO authenticated;

-- B) get_test_review RPC -------------------------------------------
CREATE OR REPLACE FUNCTION public.get_test_review(_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt   jsonb;
  v_questions jsonb;
  v_answers   jsonb;
  v_owner     uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.test_attempts WHERE id = _attempt_id;
  IF v_owner IS NULL THEN RETURN NULL; END IF;
  IF v_owner <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT to_jsonb(a) INTO v_attempt
    FROM public.test_attempts a WHERE a.id = _attempt_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.position), '[]'::jsonb)
    INTO v_questions
    FROM public.test_questions q
   WHERE q.test_id = (v_attempt->>'test_id')::uuid;

  SELECT COALESCE(jsonb_agg(to_jsonb(ans)), '[]'::jsonb)
    INTO v_answers
    FROM public.test_answers ans
   WHERE ans.attempt_id = _attempt_id;

  RETURN jsonb_build_object(
    'attempt',   v_attempt,
    'questions', v_questions,
    'answers',   v_answers
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_test_review(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_test_review(uuid) TO authenticated;

-- C) Tighten payments bucket (no public listing) -------------------
UPDATE storage.buckets SET public = false WHERE id = 'payments';

DROP POLICY IF EXISTS "payments public read" ON storage.objects;
CREATE POLICY "payments owner or admin read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payments'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );
