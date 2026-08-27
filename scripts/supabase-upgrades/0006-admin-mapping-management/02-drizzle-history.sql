BEGIN;

DO $$
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL
     OR (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 6 THEN
    RAISE EXCEPTION 'Expected exactly six existing Drizzle migration records';
  END IF;
  IF to_regprocedure('public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)') IS NULL
     OR NOT has_function_privilege('service_role', 'public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Admin mapping RPC upgrade is incomplete';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = '908447f0dd0bd0743b9bfa68d8d614d89243886436b911e542d851654c5d696f'
       OR created_at = 1787841003019
  ) THEN
    RAISE EXCEPTION 'Migration 0006 is already registered or history conflicts';
  END IF;
END;
$$;

INSERT INTO drizzle.__drizzle_migrations(hash, created_at)
VALUES ('908447f0dd0bd0743b9bfa68d8d614d89243886436b911e542d851654c5d696f', 1787841003019);

COMMIT;

SELECT count(*) AS drizzle_migration_records FROM drizzle.__drizzle_migrations;
