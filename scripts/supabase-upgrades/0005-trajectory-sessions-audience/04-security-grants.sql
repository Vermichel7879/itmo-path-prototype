BEGIN;

ALTER TABLE public.trajectory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_module_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_score_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_module_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_recommendations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trajectory_sessions, public.session_answers, public.session_module_scores,
  public.session_score_contributions, public.session_module_results, public.session_recommendations
FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.public_start_trajectory_session(text,public.education_level,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.public_get_trajectory_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.public_replace_session_answers(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.public_complete_trajectory_session(uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_start_trajectory_session(text,public.education_level,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_get_trajectory_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_replace_session_answers(uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_complete_trajectory_session(uuid,jsonb,jsonb) TO service_role;

COMMIT;

SELECT
  count(*) FILTER (WHERE has_function_privilege('service_role', p.oid, 'EXECUTE')) AS service_role_rpc_grants,
  count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE')) AS anon_rpc_grants,
  count(*) FILTER (WHERE has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS authenticated_rpc_grants
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'public_%trajectory_session%' OR n.nspname = 'public' AND p.proname = 'public_replace_session_answers';
