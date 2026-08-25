WITH required_functions(signature) AS (
  VALUES
    ('public.admin_get_login_context(text,text,text,timestamptz)'),
    ('public.admin_record_failed_login(text,text,timestamptz)'),
    ('public.admin_complete_login(uuid,text,timestamptz,text,text,timestamptz)'),
    ('public.admin_resolve_session(text,timestamptz)'),
    ('public.admin_revoke_session(text,timestamptz)'),
    ('public.admin_get_user_auth(uuid)'),
    ('public.admin_change_password(uuid,text,timestamptz)'),
    ('public.admin_list_users()'),
    ('public.admin_mutate_user(uuid,text,jsonb)'),
    ('public.admin_get_draft()'),
    ('public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb,jsonb)'),
    ('public.admin_publish_draft(uuid,timestamptz,text,text)'),
    ('public.admin_get_latest_published_summary()'),
    ('public.admin_get_latest_published_snapshot()'),
    ('public.admin_list_versions()'),
    ('public.admin_list_audit(text,text,text,timestamptz,timestamptz)')
), protected_tables(table_name) AS (
  VALUES
    ('admin_users'), ('admin_sessions'), ('admin_login_attempts'),
    ('audit_log'), ('config_versions'), ('questions'), ('answers'),
    ('answer_module_weights'), ('modules'), ('modifiers'), ('engine_rules'),
    ('documentation_examples'), ('recommendations'),
    ('module_recommendations'), ('opportunities'),
    ('entrepreneur_stages'), ('entrepreneur_challenges')
)
SELECT
  (SELECT count(*) FROM required_functions
    WHERE to_regprocedure(signature) IS NOT NULL) AS admin_rpc_functions,
  (SELECT count(*) FROM required_functions
    WHERE has_function_privilege('service_role', signature, 'EXECUTE'))
    AS service_role_rpc_grants,
  (SELECT count(*) FROM required_functions
    WHERE has_function_privilege('anon', signature, 'EXECUTE'))
    AS anon_rpc_grants,
  (SELECT count(*) FROM required_functions
    WHERE has_function_privilege('authenticated', signature, 'EXECUTE'))
    AS authenticated_rpc_grants,
  (SELECT count(*)
    FROM protected_tables
    JOIN pg_class ON pg_class.relname = protected_tables.table_name
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_namespace.nspname = 'public' AND pg_class.relrowsecurity)
    AS rls_enabled_tables,
  (SELECT count(*) FROM public.config_versions WHERE status = 'DRAFT')
    AS draft_configs,
  (SELECT count(*) FROM public.config_versions WHERE status = 'PUBLISHED')
    AS published_configs,
  (SELECT count(*) FROM public.admin_users) AS admin_users,
  (SELECT count(*) FROM drizzle.__drizzle_migrations)
    AS drizzle_migration_records,
  EXISTS (
    SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE hash = '47a26deb9246aef1d9cb19bfd3bb8996c381d022b4d1c819d1e313a24606ef7a'
      AND created_at = 1787588242530
  ) AS migration_0004_registered;
