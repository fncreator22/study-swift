
-- 1. Course access helper
CREATE OR REPLACE FUNCTION public.has_course_access(_user_id uuid, _course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (SELECT 1 FROM public.courses WHERE id = _course_id AND tier = 'free')
    OR EXISTS (SELECT 1 FROM public.purchases WHERE user_id = _user_id AND course_id = _course_id)
$$;

-- 2. Block users from directly modifying their token balance
CREATE OR REPLACE FUNCTION public.prevent_profile_token_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tokens IS DISTINCT FROM OLD.tokens AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Tokens cannot be modified directly';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_block_token_update ON public.profiles;
CREATE TRIGGER profiles_block_token_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_token_self_update();

-- 3. Block users from changing graded fields on their own attempts
CREATE OR REPLACE FUNCTION public.prevent_attempt_score_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.score IS DISTINCT FROM OLD.score
       OR NEW.total IS DISTINCT FROM OLD.total
       OR NEW.is_reviewed IS DISTINCT FROM OLD.is_reviewed
       OR NEW.feedback IS DISTINCT FROM OLD.feedback
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.test_id IS DISTINCT FROM OLD.test_id THEN
      RAISE EXCEPTION 'Only submitted_at may be updated by students';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS attempts_block_score_update ON public.test_attempts;
CREATE TRIGGER attempts_block_score_update
  BEFORE UPDATE ON public.test_attempts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_attempt_score_self_update();

-- 4. Auto-grade MCQ attempts server-side when submitted_at transitions to set
CREATE OR REPLACE FUNCTION public.grade_attempt_on_submit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_test_type text;
  v_score int := 0;
  v_total int := 0;
BEGIN
  IF NEW.submitted_at IS NULL OR OLD.submitted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT test_type INTO v_test_type FROM public.tests WHERE id = NEW.test_id;

  SELECT COUNT(*) INTO v_total
    FROM public.test_questions q
   WHERE q.test_id = NEW.test_id;

  IF v_test_type = 'mcq' THEN
    SELECT COUNT(*) INTO v_score
      FROM public.test_questions q
      JOIN public.test_answers a
        ON a.question_id = q.id AND a.attempt_id = NEW.id
     WHERE q.test_id = NEW.test_id
       AND q.question_type = 'mcq'
       AND a.selected_option IS NOT NULL
       AND lower(a.selected_option) = lower(q.correct_option);

    NEW.score := v_score;
    NEW.total := v_total;
    NEW.is_reviewed := true;
  ELSE
    NEW.score := 0;
    NEW.total := v_total;
    NEW.is_reviewed := false;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS attempts_autograde ON public.test_attempts;
CREATE TRIGGER attempts_autograde
  BEFORE UPDATE ON public.test_attempts
  FOR EACH ROW EXECUTE FUNCTION public.grade_attempt_on_submit();

-- 5. Remove user self-insert on purchases & wallet_transactions
DROP POLICY IF EXISTS "purchases self insert" ON public.purchases;
DROP POLICY IF EXISTS "wallet self insert" ON public.wallet_transactions;

-- 6. Trusted RPC: purchase a test or course with tokens
CREATE OR REPLACE FUNCTION public.purchase_with_tokens(_test_id uuid, _course_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_price numeric := 0;
  v_tier text;
  v_balance int;
  v_cost int;
  v_purchase_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF (_test_id IS NULL) = (_course_id IS NULL) THEN
    RAISE EXCEPTION 'Provide exactly one of test_id or course_id';
  END IF;

  IF _test_id IS NOT NULL THEN
    SELECT price, tier::text INTO v_price, v_tier FROM public.tests WHERE id = _test_id;
    IF v_tier IS NULL THEN RAISE EXCEPTION 'Test not found'; END IF;
    IF v_tier = 'free' THEN RAISE EXCEPTION 'Test is free'; END IF;
    IF EXISTS (SELECT 1 FROM public.purchases WHERE user_id = v_user AND test_id = _test_id) THEN
      RAISE EXCEPTION 'Already purchased';
    END IF;
  ELSE
    SELECT price, tier INTO v_price, v_tier FROM public.courses WHERE id = _course_id;
    IF v_tier IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
    IF v_tier = 'free' THEN RAISE EXCEPTION 'Course is free'; END IF;
    IF EXISTS (SELECT 1 FROM public.purchases WHERE user_id = v_user AND course_id = _course_id) THEN
      RAISE EXCEPTION 'Already purchased';
    END IF;
  END IF;

  v_cost := GREATEST(0, CEIL(v_price)::int);

  SELECT tokens INTO v_balance FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile missing'; END IF;
  IF v_balance < v_cost THEN RAISE EXCEPTION 'Insufficient tokens'; END IF;

  UPDATE public.profiles SET tokens = tokens - v_cost WHERE id = v_user;

  INSERT INTO public.purchases (user_id, test_id, course_id)
  VALUES (v_user, _test_id, _course_id)
  RETURNING id INTO v_purchase_id;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description)
  VALUES (v_user, -v_cost, 'purchase',
          CASE WHEN _test_id IS NOT NULL THEN 'Test purchase' ELSE 'Course purchase' END);

  RETURN jsonb_build_object('purchase_id', v_purchase_id, 'spent', v_cost);
END;
$$;

-- 7. Hide correct_option from students via secure view + admin-only table SELECT
DROP POLICY IF EXISTS "questions access read" ON public.test_questions;
CREATE POLICY "questions admin read" ON public.test_questions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.test_questions_secure
WITH (security_invoker = false) AS
SELECT
  q.id, q.test_id, q.question, q.question_type,
  q.option_a, q.option_b, q.option_c, q.option_d,
  q.position, q.max_words, q.created_at
FROM public.test_questions q
WHERE public.has_test_access(auth.uid(), q.test_id);

REVOKE ALL ON public.test_questions_secure FROM PUBLIC, anon;
GRANT SELECT ON public.test_questions_secure TO authenticated;

-- 8. Restrict videos to purchased / free / admin
DROP POLICY IF EXISTS "videos read all" ON public.videos;
CREATE POLICY "videos access read" ON public.videos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR course_id IS NULL
    OR public.has_course_access(auth.uid(), course_id)
  );

-- 9. Comments insert must enforce course OR test access
DROP POLICY IF EXISTS "comments self insert" ON public.comments;
CREATE POLICY "comments self insert" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (test_id IS NOT NULL AND public.has_test_access(auth.uid(), test_id))
      OR (course_id IS NOT NULL AND public.has_course_access(auth.uid(), course_id))
    )
  );

-- 10. Revoke EXECUTE on SECURITY DEFINER fns from anon (keep authenticated where needed)
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.has_test_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_test_access(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.has_course_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_course_access(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_test_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_test_review(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.purchase_with_tokens(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_with_tokens(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.prevent_profile_token_self_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_attempt_score_self_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grade_attempt_on_submit() FROM PUBLIC, anon, authenticated;
