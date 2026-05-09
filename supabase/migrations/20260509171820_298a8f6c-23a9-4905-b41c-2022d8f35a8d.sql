
DROP VIEW IF EXISTS public.rankings_view;
CREATE VIEW public.rankings_view WITH (security_invoker = true) AS
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

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_test_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_test_access(uuid, uuid) TO authenticated;
