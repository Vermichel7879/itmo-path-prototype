-- Supabase SQL Editor chunk 06: Drizzle migration history
-- Run this file once, only after the preceding chunk succeeded.

BEGIN;

CREATE SCHEMA IF NOT EXISTS "drizzle";

CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  "id" SERIAL PRIMARY KEY,
  "hash" text NOT NULL,
  "created_at" bigint
);

DO $drizzle_history_guard$
DECLARE
  project_table_count integer;
BEGIN
  SELECT count(*)::integer
  INTO project_table_count
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
    );

  IF project_table_count <> 14 THEN
    RAISE EXCEPTION 'Expected all 14 project tables before recording migration history';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'config_versions_published_snapshot'
      AND conrelid = 'public.config_versions'::regclass
  ) OR to_regprocedure('public.prevent_published_config_mutation()') IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'config_versions_published_immutable'
        AND tgrelid = 'public.config_versions'::regclass
        AND NOT tgisinternal
    ) THEN
    RAISE EXCEPTION 'Published configuration guard is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "drizzle"."__drizzle_migrations"
    WHERE "hash" IN ('62301519202da607f47d3ef037c5da3353e9b295d5c3e0825f0ac56c75aeb34c', 'aa18dabe511160ce44cf164f71d7d92c3a8829c22336e1662beda6dee07518c0')
       OR "created_at" IN (1787505965865, 1787505995250)
  ) THEN
    RAISE EXCEPTION 'Migration history already contains 0000 or 0001';
  END IF;
END
$drizzle_history_guard$;

INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
VALUES ('62301519202da607f47d3ef037c5da3353e9b295d5c3e0825f0ac56c75aeb34c', 1787505965865);

INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
VALUES ('aa18dabe511160ce44cf164f71d7d92c3a8829c22336e1662beda6dee07518c0', 1787505995250);

COMMIT;

-- Read-only verification for this chunk.
SELECT
  '06' AS chunk,
  count(*)::integer AS expected_objects_found,
  2 AS expected_objects_total
FROM "drizzle"."__drizzle_migrations"
WHERE ("hash" = '62301519202da607f47d3ef037c5da3353e9b295d5c3e0825f0ac56c75aeb34c'
    AND "created_at" = 1787505965865)
   OR ("hash" = 'aa18dabe511160ce44cf164f71d7d92c3a8829c22336e1662beda6dee07518c0'
    AND "created_at" = 1787505995250);
