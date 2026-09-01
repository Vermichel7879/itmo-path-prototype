BEGIN;

DO $$
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL
     OR (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 12 THEN
    RAISE EXCEPTION 'Expected exactly twelve existing Drizzle migration records';
  END IF;

  IF to_regprocedure('public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb)') IS NULL
     OR NOT has_function_privilege('service_role', 'public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Admin MODULE_GUARD create RPC upgrade is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = '0ff3b9354eb526a0cee5580c9e05d501de7887fcc402a42c352a44bce4496637'
       OR created_at = 1788243000000
  ) THEN
    RAISE EXCEPTION 'Migration 0012 is already registered or history conflicts';
  END IF;
END;
$$;

INSERT INTO drizzle.__drizzle_migrations(hash, created_at)
VALUES ('0ff3b9354eb526a0cee5580c9e05d501de7887fcc402a42c352a44bce4496637', 1788243000000);

COMMIT;

SELECT count(*)::integer AS migration_0012_records
FROM drizzle.__drizzle_migrations
WHERE hash = '0ff3b9354eb526a0cee5580c9e05d501de7887fcc402a42c352a44bce4496637'
  AND created_at = 1788243000000;
