SELECT
  to_regprocedure('public.admin_create_module(uuid,timestamptz,text,text,jsonb,jsonb)') IS NOT NULL
    AS module_create_rpc_exists,
  has_function_privilege('service_role', 'public.admin_create_module(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE')
    AS service_role_execute,
  NOT has_function_privilege('anon', 'public.admin_create_module(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE')
    AS anon_execute_denied,
  NOT has_function_privilege('authenticated', 'public.admin_create_module(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE')
    AS authenticated_execute_denied,
  (
    SELECT count(*) = 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = '0b7d60fa3fdb5f6942da3fb5adcb9d74a8acc4d336b4cd73d7f7a5c3dc273a94'
      AND created_at = 1788237833172
  ) AS migration_0011_registered_once,
  (SELECT count(*) FROM public.config_versions WHERE status = 'DRAFT') AS draft_configs,
  (SELECT count(*) FROM public.config_versions WHERE status = 'PUBLISHED') AS published_configs,
  (SELECT count(*) FROM drizzle.__drizzle_migrations) AS drizzle_migration_records;

