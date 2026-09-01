BEGIN;

DO $$
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL
     OR (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 11 THEN
    RAISE EXCEPTION 'Expected exactly eleven existing Drizzle migration records';
  END IF;

  IF to_regprocedure('public.admin_create_module(uuid,timestamptz,text,text,jsonb,jsonb)') IS NULL
     OR NOT has_function_privilege('service_role', 'public.admin_create_module(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_create_module(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_create_module(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Admin module create RPC upgrade is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = '0b7d60fa3fdb5f6942da3fb5adcb9d74a8acc4d336b4cd73d7f7a5c3dc273a94'
       OR created_at = 1788237833172
  ) THEN
    RAISE EXCEPTION 'Migration 0011 is already registered or history conflicts';
  END IF;
END;
$$;

INSERT INTO drizzle.__drizzle_migrations(hash, created_at)
VALUES ('0b7d60fa3fdb5f6942da3fb5adcb9d74a8acc4d336b4cd73d7f7a5c3dc273a94', 1788237833172);

COMMIT;

SELECT count(*)::integer AS migration_0011_records
FROM drizzle.__drizzle_migrations
WHERE hash = '0b7d60fa3fdb5f6942da3fb5adcb9d74a8acc4d336b4cd73d7f7a5c3dc273a94'
  AND created_at = 1788237833172;

