BEGIN;

DO $$
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL
     OR (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 7 THEN
    RAISE EXCEPTION 'Expected exactly seven existing Drizzle migration records';
  END IF;
  IF to_regprocedure('public.admin_mutate_module_recommendation(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)') IS NULL
     OR NOT has_function_privilege('service_role', 'public.admin_mutate_module_recommendation(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_mutate_module_recommendation(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_mutate_module_recommendation(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Admin module recommendation RPC upgrade is incomplete';
  END IF;
  IF EXISTS (
    SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE hash = '5ec09f57cb23ae10ee87d85be997257e65ec1b1582c0c8d6916d554a4d854498'
       OR created_at = 1787851250484
  ) THEN
    RAISE EXCEPTION 'Migration 0007 is already registered or history conflicts';
  END IF;
END;
$$;

INSERT INTO drizzle.__drizzle_migrations(hash, created_at)
VALUES ('5ec09f57cb23ae10ee87d85be997257e65ec1b1582c0c8d6916d554a4d854498', 1787851250484);

COMMIT;

SELECT count(*) AS drizzle_migration_records FROM drizzle.__drizzle_migrations;
