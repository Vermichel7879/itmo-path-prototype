SELECT
  to_regclass('public.admin_login_attempts') IS NOT NULL
    AS admin_login_attempts_exists,
  coalesce(
    (SELECT count(*) FROM admin_login_attempts),
    0
  ) AS admin_login_attempt_records,
  (SELECT count(*) FROM opportunities) AS opportunities,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'config_version_id'
      AND is_nullable = 'NO'
  ) AS opportunities_versioned,
  EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND constraint_name = 'opportunities_config_version_id_config_versions_id_fk'
      AND constraint_type = 'FOREIGN KEY'
  ) AS opportunities_version_fk_exists,
  to_regclass('public.opportunities_version_stable_unique') IS NOT NULL
    AS opportunities_version_stable_index_exists,
  to_regprocedure(
    'public.read_published_config_snapshot_chunk(uuid,integer,integer)'
  ) IS NOT NULL AS published_snapshot_reader_exists,
  (SELECT count(*) FROM config_versions WHERE status = 'DRAFT')
    AS draft_configs,
  (SELECT count(*) FROM config_versions WHERE status = 'PUBLISHED')
    AS published_configs,
  (
    SELECT id
    FROM config_versions
    WHERE status = 'PUBLISHED'
    ORDER BY published_at DESC, version_number DESC
    LIMIT 1
  ) AS latest_published_id,
  (SELECT count(*) FROM drizzle.__drizzle_migrations)
    AS drizzle_migration_records,
  EXISTS (
    SELECT 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = 'e403df6c64a2ae16aa15fbf0c8b809d8e0340957bec648c7bd2f98401c1a0122'
      AND created_at = 1787567239361
  ) AS migration_0003_registered;
