
-- Add membership status columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_status text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_expiry timestamptz;

-- Subscription plans (admin-defined)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  token_price int NOT NULL DEFAULT 0,
  duration_days int NOT NULL DEFAULT 30,
  test_ids uuid[] NOT NULL DEFAULT '{}',
  course_ids uuid[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subs read all" ON public.subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "subs admin write" ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Link memberships to subscriptions
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_subscription ON public.memberships(subscription_id);

-- Allow user to insert via RPC only; for now keep self read existing
-- RPC: purchase a subscription with tokens (atomic)
CREATE OR REPLACE FUNCTION public.purchase_subscription(_subscription_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cost int;
  v_days int;
  v_balance int;
  v_active boolean;
  v_membership_id uuid;
  v_valid_until timestamptz;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT token_price, duration_days, is_active
    INTO v_cost, v_days, v_active
    FROM public.subscriptions WHERE id = _subscription_id;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'Plan not found'; END IF;
  IF NOT v_active THEN RAISE EXCEPTION 'Plan inactive'; END IF;

  SELECT tokens INTO v_balance FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile missing'; END IF;
  IF v_balance < v_cost THEN RAISE EXCEPTION 'Insufficient tokens'; END IF;

  UPDATE public.profiles SET tokens = tokens - v_cost WHERE id = v_user;

  v_valid_until := now() + (v_days || ' days')::interval;

  INSERT INTO public.memberships (user_id, plan, valid_until, subscription_id, status)
  VALUES (v_user, 'premium', v_valid_until, _subscription_id, 'active')
  RETURNING id INTO v_membership_id;

  UPDATE public.profiles
     SET membership_status = 'premium',
         subscription_expiry = v_valid_until
   WHERE id = v_user;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description)
  VALUES (v_user, -v_cost, 'subscription', 'Subscription purchase');

  RETURN jsonb_build_object('membership_id', v_membership_id, 'valid_until', v_valid_until);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_subscription(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.purchase_subscription(uuid) TO authenticated;

-- Subscription-based access helper: extend has_test_access / has_course_access
CREATE OR REPLACE FUNCTION public.has_active_subscription_for_test(_user_id uuid, _test_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.subscriptions s ON s.id = m.subscription_id
    WHERE m.user_id = _user_id
      AND m.status = 'active'
      AND m.valid_until > now()
      AND _test_id = ANY(s.test_ids)
  )
$$;

CREATE OR REPLACE FUNCTION public.has_active_subscription_for_course(_user_id uuid, _course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.subscriptions s ON s.id = m.subscription_id
    WHERE m.user_id = _user_id
      AND m.status = 'active'
      AND m.valid_until > now()
      AND _course_id = ANY(s.course_ids)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_active_subscription_for_test(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription_for_course(uuid, uuid) FROM anon;

-- Update access helpers to include subscription
CREATE OR REPLACE FUNCTION public.has_test_access(_user_id uuid, _test_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (SELECT 1 FROM public.tests WHERE id = _test_id AND tier = 'free')
    OR EXISTS (SELECT 1 FROM public.purchases WHERE user_id = _user_id AND test_id = _test_id)
    OR public.has_active_subscription_for_test(_user_id, _test_id)
$$;

CREATE OR REPLACE FUNCTION public.has_course_access(_user_id uuid, _course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (SELECT 1 FROM public.courses WHERE id = _course_id AND tier = 'free')
    OR EXISTS (SELECT 1 FROM public.purchases WHERE user_id = _user_id AND course_id = _course_id)
    OR public.has_active_subscription_for_course(_user_id, _course_id)
$$;
