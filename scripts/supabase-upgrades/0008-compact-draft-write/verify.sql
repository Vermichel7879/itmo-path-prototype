SELECT
  to_regprocedure('public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb)') IS NOT NULL AS compact_rpc_exists,
  has_function_privilege('service_role', 'public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb)', 'EXECUTE') AS compact_rpc_granted,
  NOT has_function_privilege('anon', 'public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb)', 'EXECUTE') AS anon_denied,
  NOT has_function_privilege('authenticated', 'public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb)', 'EXECUTE') AS authenticated_denied,
  NOT has_function_privilege('service_role', 'public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb,jsonb)', 'EXECUTE') AS legacy_snapshot_rpc_revoked,
  NOT has_function_privilege('service_role', 'public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE') AS legacy_mapping_rpc_revoked,
  NOT has_function_privilege('service_role', 'public.admin_mutate_module_recommendation(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE') AS legacy_module_recommendation_rpc_revoked,
  (SELECT count(*) FROM public.config_versions WHERE status = 'DRAFT') AS draft_configs,
  (SELECT count(*) FROM public.config_versions WHERE status = 'PUBLISHED') AS published_configs,
  (SELECT count(*) FROM drizzle.__drizzle_migrations) AS drizzle_migration_records,
  EXISTS (
    SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE hash = 'b46842f7fc171c909841f69cdaec213656e8bcd255c7862a8bbdc730745720c1'
      AND created_at = 1787856437820
  ) AS migration_0008_registered;
