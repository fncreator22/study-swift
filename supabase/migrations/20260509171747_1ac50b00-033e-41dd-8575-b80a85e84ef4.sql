
CREATE TYPE public.app_role AS ENUM ('admin', 'student');
CREATE TYPE public.test_tier AS ENUM ('free', 'paid', 'premium');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  college TEXT NOT NULL DEFAULT '',
  blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  tier test_tier NOT NULL DEFAULT 'free',
  duration_min INT NOT NULL DEFAULT 30,
  total_marks INT NOT NULL DEFAULT 0,
  instructions TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  score INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0
);
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.test_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.test_questions(id) ON DELETE CASCADE,
  selected_option TEXT,
  UNIQUE(attempt_id, question_id)
);
ALTER TABLE public.test_answers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, test_id)
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_test_access(_user_id UUID, _test_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (SELECT 1 FROM public.tests WHERE id = _test_id AND tier = 'free')
    OR EXISTS (SELECT 1 FROM public.purchases WHERE user_id = _user_id AND test_id = _test_id)
$$;

-- profiles
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles admin delete" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles admin write" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tests
CREATE POLICY "tests read all auth" ON public.tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "tests admin write" ON public.tests FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- test_questions
CREATE POLICY "questions access read" ON public.test_questions FOR SELECT TO authenticated USING (public.has_test_access(auth.uid(), test_id));
CREATE POLICY "questions admin write" ON public.test_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- test_attempts
CREATE POLICY "attempts self read" ON public.test_attempts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "attempts self insert" ON public.test_attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.has_test_access(auth.uid(), test_id));
CREATE POLICY "attempts self update" ON public.test_attempts FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- test_answers
CREATE POLICY "answers self read" ON public.test_answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND (a.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "answers self write" ON public.test_answers FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid())
);

-- purchases
CREATE POLICY "purchases self read" ON public.purchases FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "purchases self insert" ON public.purchases FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "purchases admin delete" ON public.purchases FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- videos
CREATE POLICY "videos read all" ON public.videos FOR SELECT TO authenticated USING (true);
CREATE POLICY "videos admin write" ON public.videos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- comments
CREATE POLICY "comments read all" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments self insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.has_test_access(auth.uid(), test_id));
CREATE POLICY "comments self delete" ON public.comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, college)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.raw_user_meta_data->>'college',''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE VIEW public.rankings_view AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.college,
  COALESCE(SUM(a.score),0)::int AS total_score,
  COUNT(a.id)::int AS attempts_count,
  CASE WHEN COALESCE(SUM(a.total),0) > 0
    THEN ROUND((SUM(a.score)::numeric / NULLIF(SUM(a.total),0)) * 100, 2)
    ELSE 0 END AS avg_percentage
FROM public.profiles p
LEFT JOIN public.test_attempts a ON a.user_id = p.id AND a.submitted_at IS NOT NULL
GROUP BY p.id, p.full_name, p.college;

GRANT SELECT ON public.rankings_view TO authenticated;
