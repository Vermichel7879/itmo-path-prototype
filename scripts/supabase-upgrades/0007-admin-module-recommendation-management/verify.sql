SELECT
  to_regprocedure('public.admin_mutate_module_recommendation(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)') IS NOT NULL AS module_recommendation_rpc_exists,
  has_function_privilege('service_role', 'public.admin_mutate_module_recommendation(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE') AS service_role_execute,
  has_function_privilege('anon', 'public.admin_mutate_module_recommendation(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', 'public.admin_mutate_module_recommendation(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE') AS authenticated_execute,
  (SELECT count(*) FROM public.config_versions WHERE status = 'DRAFT') AS draft_configs,
  (SELECT count(*) FROM public.config_versions WHERE status = 'PUBLISHED') AS published_configs,
  (SELECT count(*) FROM drizzle.__drizzle_migrations) AS drizzle_migration_records,
  EXISTS (
    SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE hash = '5ec09f57cb23ae10ee87d85be997257e65ec1b1582c0c8d6916d554a4d854498'
      AND created_at = 1787851250484
  ) AS migration_0007_registered;
