SELECT
  to_regprocedure('public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)') IS NOT NULL AS mapping_rpc_exists,
  has_function_privilege('service_role', 'public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE') AS service_role_execute,
  has_function_privilege('anon', 'public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', 'public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE') AS authenticated_execute,
  (SELECT count(*) FROM public.config_versions WHERE status = 'DRAFT') AS draft_configs,
  (SELECT count(*) FROM public.config_versions WHERE status = 'PUBLISHED') AS published_configs,
  (SELECT count(*) FROM drizzle.__drizzle_migrations) AS drizzle_migration_records,
  EXISTS (
    SELECT 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = '908447f0dd0bd0743b9bfa68d8d614d89243886436b911e542d851654c5d696f'
      AND created_at = 1787841003019
  ) AS migration_0006_registered;
