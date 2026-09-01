SELECT
  to_regprocedure('public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb)') IS NOT NULL
    AS module_guard_create_rpc_exists,
  has_function_privilege('service_role', 'public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE')
    AS service_role_execute,
  NOT has_function_privilege('anon', 'public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE')
    AS anon_execute_denied,
  NOT has_function_privilege('authenticated', 'public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE')
    AS authenticated_execute_denied,
  pg_get_constraintdef(rule_constraint.oid) LIKE '%[1-9][0-9]+%'
    AS extended_rule_id_constraint,
  (
    SELECT count(*) = 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = '0ff3b9354eb526a0cee5580c9e05d501de7887fcc402a42c352a44bce4496637'
      AND created_at = 1788243000000
  ) AS migration_0012_registered_once,
  (SELECT count(*) FROM public.config_versions WHERE status = 'DRAFT') AS draft_configs,
  (SELECT count(*) FROM public.config_versions WHERE status = 'PUBLISHED') AS published_configs,
  (SELECT count(*) FROM drizzle.__drizzle_migrations) AS drizzle_migration_records
FROM pg_constraint rule_constraint
WHERE rule_constraint.conname = 'engine_rules_stable_id_format';
