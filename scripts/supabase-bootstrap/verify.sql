-- Final read-only verification. Run only after chunks 01 through 06 succeeded.
SELECT
  (
    SELECT count(*)::integer
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name IN (
        'admin_users',
        'admin_sessions',
        'config_versions',
        'questions',
        'answers',
        'answer_module_weights',
        'modules',
        'modifiers',
        'recommendations',
        'module_recommendations',
        'opportunities',
        'entrepreneur_stages',
        'entrepreneur_challenges',
        'audit_log'
      )
  ) AS project_tables_found,
  to_regclass('public.config_versions') IS NOT NULL AS config_versions_exists,
  to_regclass('public.questions') IS NOT NULL AS questions_exists,
  to_regclass('public.modules') IS NOT NULL AS modules_exists,
  (
    SELECT count(*)::integer
    FROM "drizzle"."__drizzle_migrations"
  ) AS drizzle_migration_records;
