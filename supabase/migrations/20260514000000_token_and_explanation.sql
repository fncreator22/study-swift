
-- Add tokens to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tokens INTEGER NOT NULL DEFAULT 0;

-- Token requests table
CREATE TABLE IF NOT EXISTS public.token_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  screenshot_url TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.token_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "token_requests self read" ON public.token_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "token_requests self insert" ON public.token_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "token_requests admin update" ON public.token_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Wallet transactions table (for history)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'unlock', 'refund', 'admin_adj')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_transactions self read" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wallet_transactions admin write" ON public.wallet_transactions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- MCQ Explanations
ALTER TABLE public.test_questions ADD COLUMN IF NOT EXISTS explanation TEXT;

-- Update test_questions policy to include explanation (it already has access read)
-- Ensure admin can write to it (already has admin write)

-- Trigger for token approval
CREATE OR REPLACE FUNCTION public.handle_token_request_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Update user's tokens
    UPDATE public.profiles
    SET tokens = tokens + NEW.amount
    WHERE id = NEW.user_id;

    -- Create transaction entry
    INSERT INTO public.wallet_transactions (user_id, amount, type, description)
    VALUES (NEW.user_id, NEW.amount, 'purchase', 'Token purchase approved');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_token_request_approved
  AFTER UPDATE ON public.token_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_token_request_approval();

-- Storage bucket for payments (if not already handled by Supabase config)
INSERT INTO storage.buckets (id, name, public) VALUES ('payments', 'payments', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'payments');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payments' AND auth.role() = 'authenticated');
