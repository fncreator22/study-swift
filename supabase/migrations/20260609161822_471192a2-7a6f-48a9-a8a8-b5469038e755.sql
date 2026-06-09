
-- Performance indexes (missing)
CREATE INDEX IF NOT EXISTS idx_test_attempts_submitted ON public.test_attempts(submitted_at);
CREATE INDEX IF NOT EXISTS idx_test_attempts_status ON public.test_attempts(status);
CREATE INDEX IF NOT EXISTS idx_wallet_created ON public.wallet_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_type ON public.wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);
CREATE INDEX IF NOT EXISTS idx_memberships_valid_until ON public.memberships(valid_until);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_membership ON public.profiles(membership_status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_tier ON public.courses(tier);
CREATE INDEX IF NOT EXISTS idx_tests_tier ON public.tests(tier);
CREATE INDEX IF NOT EXISTS idx_videos_position ON public.videos(course_id, position);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_created ON public.ticket_replies(created_at);

NOTIFY pgrst, 'reload schema';
