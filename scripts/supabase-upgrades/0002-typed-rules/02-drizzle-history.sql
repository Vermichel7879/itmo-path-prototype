-- Register migration 0002 only after 01-schema.sql completed successfully.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.engine_rules') IS NULL
     OR to_regclass('public.documentation_examples') IS NULL THEN
    RAISE EXCEPTION 'Typed-rules schema is incomplete';
  END IF;
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Drizzle migration history table is missing';
  END IF;
  IF (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 2 THEN
    RAISE EXCEPTION 'Expected exactly two existing Drizzle migration records';
  END IF;
  IF EXISTS (
    SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE hash = '98cc35fcff91db1086d946b401e9c9b4af1d0e2314e62b321c0d4f23a2a7bc5b'
       OR created_at = 1787522747953
  ) THEN
    RAISE EXCEPTION 'Migration 0002 is already registered or history conflicts';
  END IF;
END;
$$;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES (
  '98cc35fcff91db1086d946b401e9c9b4af1d0e2314e62b321c0d4f23a2a7bc5b',
  1787522747953
);

COMMIT;

SELECT count(*) AS drizzle_migration_records
FROM drizzle.__drizzle_migrations;
