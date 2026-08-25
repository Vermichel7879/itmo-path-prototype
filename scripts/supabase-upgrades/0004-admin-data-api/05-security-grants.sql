BEGIN;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_module_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentation_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrepreneur_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrepreneur_challenges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.admin_users,
  public.admin_sessions,
  public.admin_login_attempts,
  public.audit_log,
  public.config_versions,
  public.questions,
  public.answers,
  public.answer_module_weights,
  public.modules,
  public.modifiers,
  public.engine_rules,
  public.documentation_examples,
  public.recommendations,
  public.module_recommendations,
  public.opportunities,
  public.entrepreneur_stages,
  public.entrepreneur_challenges
FROM anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_get_login_context(text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_record_failed_login(text,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_complete_login(uuid,text,timestamptz,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_session(text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_session(text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_user_auth(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_change_password(uuid,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_mutate_user(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_draft() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_publish_draft(uuid,timestamptz,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_latest_published_summary() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_latest_published_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_versions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_audit(text,text,text,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_login_context(text,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_record_failed_login(text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_complete_login(uuid,text,timestamptz,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_resolve_session(text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_session(text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_user_auth(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_change_password(uuid,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_mutate_user(uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_draft() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_publish_draft(uuid,timestamptz,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_latest_published_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_latest_published_snapshot() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_versions() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_audit(text,text,text,timestamptz,timestamptz) TO service_role;

COMMIT;

SELECT
  has_function_privilege('service_role', 'public.admin_complete_login(uuid,text,timestamptz,text,text,timestamptz)', 'EXECUTE')
    AS service_role_login_execute,
  has_function_privilege('service_role', 'public.admin_mutate_user(uuid,text,jsonb)', 'EXECUTE')
    AS service_role_user_execute,
  has_function_privilege('service_role', 'public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb,jsonb)', 'EXECUTE')
    AS service_role_draft_execute,
  has_function_privilege('service_role', 'public.admin_publish_draft(uuid,timestamptz,text,text)', 'EXECUTE')
    AS service_role_publish_execute,
  NOT has_function_privilege('anon', 'public.admin_complete_login(uuid,text,timestamptz,text,text,timestamptz)', 'EXECUTE')
    AS anon_login_denied,
  NOT has_function_privilege('authenticated', 'public.admin_publish_draft(uuid,timestamptz,text,text)', 'EXECUTE')
    AS authenticated_publish_denied;
