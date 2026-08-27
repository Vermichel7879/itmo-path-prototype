SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('trajectory_sessions','session_answers','session_module_scores','session_score_contributions','session_module_results','session_recommendations')) AS session_tables,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('public_start_trajectory_session','public_get_trajectory_session','public_replace_session_answers','public_complete_trajectory_session')) AS session_rpc_functions,
  (SELECT count(*) FROM public.config_versions WHERE status='DRAFT') AS draft_configs,
  (SELECT count(*) FROM public.config_versions WHERE status='PUBLISHED') AS published_configs,
  (SELECT count(*) FROM drizzle.__drizzle_migrations) AS drizzle_migration_records,
  EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash='6b828e3c1fc4b98810916ee2d20d6527c9cf2f358937905ed70ad81f35bc119b' AND created_at=1787822638754) AS migration_0005_registered,
  NOT EXISTS (
    SELECT 1 FROM public.config_versions config,
      jsonb_array_elements(COALESCE(config.snapshot -> 'questions','[]'::jsonb)) question(item)
    WHERE config.status = 'DRAFT'
      AND NOT (question.item ? 'forBachelor' AND question.item ? 'forMaster')
  ) AS draft_question_audience_backfilled,
  NOT EXISTS (
    SELECT 1 FROM public.config_versions config,
      jsonb_array_elements(COALESCE(config.snapshot -> 'questions','[]'::jsonb)) question(item)
    WHERE config.status = 'PUBLISHED'
      AND COALESCE((question.item ->> 'active')::boolean, false)
      AND (
        NOT COALESCE((question.item ->> 'forMaster')::boolean, true)
        OR COALESCE((question.item ->> 'forBachelor')::boolean, false)
      )
  ) AS published_effective_master;
