
-- 1. Atomic token request approval/rejection RPCs
CREATE OR REPLACE FUNCTION public.approve_token_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_req record;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Lock row to prevent concurrent approval
  SELECT id, user_id, amount, status INTO v_req
    FROM public.token_requests
    WHERE id = _request_id
    FOR UPDATE;

  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already %', v_req.status;
  END IF;

  UPDATE public.token_requests
     SET status = 'approved', updated_at = now()
   WHERE id = _request_id;

  UPDATE public.profiles
     SET tokens = COALESCE(tokens, 0) + v_req.amount
   WHERE id = v_req.user_id;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description)
  VALUES (v_req.user_id, v_req.amount, 'token_purchase',
          'Approved token request ' || _request_id::text);

  RETURN jsonb_build_object('ok', true, 'amount', v_req.amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_token_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_status text;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT status INTO v_status FROM public.token_requests
    WHERE id = _request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Request already %', v_status; END IF;

  UPDATE public.token_requests
     SET status = 'rejected', updated_at = now()
   WHERE id = _request_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 2. Server-side timer enforcement for test submission
CREATE OR REPLACE FUNCTION public.submit_attempt(_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_att record;
  v_duration int;
  v_grace int := 30; -- seconds grace for network latency
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, user_id, test_id, started_at, submitted_at
    INTO v_att
    FROM public.test_attempts
    WHERE id = _attempt_id
    FOR UPDATE;

  IF v_att.id IS NULL THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF v_att.user_id <> v_user THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_att.submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  SELECT duration_min INTO v_duration FROM public.tests WHERE id = v_att.test_id;
  IF v_duration IS NULL THEN RAISE EXCEPTION 'Test missing'; END IF;

  -- Reject answers added after the timer + grace period
  IF v_att.started_at + ((v_duration * 60 + v_grace) || ' seconds')::interval < now() THEN
    -- Still mark submitted but at deadline so grading runs over answers saved in time
    UPDATE public.test_attempts
       SET submitted_at = v_att.started_at + (v_duration || ' minutes')::interval
     WHERE id = _attempt_id;
    -- Remove any answers saved after the deadline
    DELETE FROM public.test_answers
     WHERE attempt_id = _attempt_id
       AND created_at > v_att.started_at + (v_duration || ' minutes')::interval;
    RETURN jsonb_build_object('ok', true, 'late', true);
  END IF;

  UPDATE public.test_attempts
     SET submitted_at = now()
   WHERE id = _attempt_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Block blocked users from submitting any new attempts
CREATE OR REPLACE FUNCTION public.start_fresh_attempt(_test_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_new uuid;
  v_blocked boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT blocked INTO v_blocked FROM public.profiles WHERE id = v_user;
  IF v_blocked THEN RAISE EXCEPTION 'Account blocked'; END IF;
  IF NOT public.has_test_access(v_user, _test_id) THEN
    RAISE EXCEPTION 'No access';
  END IF;
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
