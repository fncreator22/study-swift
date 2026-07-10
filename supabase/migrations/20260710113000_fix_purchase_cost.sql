-- Redefine purchase_with_tokens to charge 1 token per 10 Rupees (align with 1 Token = 10 Rupees rate)
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

  v_cost := GREATEST(0, CEIL(v_price / 10.0)::int);

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
