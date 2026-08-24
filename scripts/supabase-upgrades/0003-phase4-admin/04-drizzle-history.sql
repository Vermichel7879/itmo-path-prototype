-- Register migration 0003 only after chunks 01, 02 and 03 completed successfully.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.admin_login_attempts') IS NULL
     OR to_regclass('public.opportunities_version_stable_unique') IS NULL
     OR to_regclass('public.opportunities_version_type_active_idx') IS NULL
     OR to_regprocedure(
       'public.read_published_config_snapshot_chunk(uuid,integer,integer)'
     ) IS NULL THEN
    RAISE EXCEPTION 'PHASE 4 schema objects are incomplete';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'config_version_id'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'opportunities.config_version_id is incomplete';
  END IF;
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL
     OR (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 3 THEN
    RAISE EXCEPTION 'Expected exactly three existing Drizzle migration records';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = 'e403df6c64a2ae16aa15fbf0c8b809d8e0340957bec648c7bd2f98401c1a0122'
       OR created_at = 1787567239361
  ) THEN
    RAISE EXCEPTION 'Migration 0003 is already registered or history conflicts';
  END IF;
END;
$$;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES (
  'e403df6c64a2ae16aa15fbf0c8b809d8e0340957bec648c7bd2f98401c1a0122',
  1787567239361
);

COMMIT;

SELECT count(*) AS drizzle_migration_records
FROM drizzle.__drizzle_migrations;
