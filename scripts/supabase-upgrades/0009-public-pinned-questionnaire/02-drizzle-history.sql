BEGIN;

DO $$
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL
     OR (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 9 THEN
    RAISE EXCEPTION 'Expected exactly nine existing Drizzle migration records';
  END IF;

  IF to_regprocedure('public.public_get_pinned_questionnaire(uuid,public.education_level)') IS NULL
     OR to_regprocedure('public.public_get_pinned_engine_config(uuid)') IS NULL
     OR NOT has_function_privilege('service_role', 'public.public_get_pinned_questionnaire(uuid,public.education_level)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.public_get_pinned_engine_config(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.public_get_pinned_questionnaire(uuid,public.education_level)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.public_get_pinned_engine_config(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.public_get_pinned_questionnaire(uuid,public.education_level)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.public_get_pinned_engine_config(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Public pinned configuration RPC upgrade is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = 'faa424d956d194445f882b036778ec8f00822580c5a8edfe69d9a458b0fc26b7'
       OR created_at = 1788143210743
  ) THEN
    RAISE EXCEPTION 'Migration 0009 is already registered or history conflicts';
  END IF;
END;
$$;

INSERT INTO drizzle.__drizzle_migrations(hash, created_at)
VALUES ('faa424d956d194445f882b036778ec8f00822580c5a8edfe69d9a458b0fc26b7', 1788143210743);

COMMIT;

SELECT count(*)::integer AS migration_0009_records
FROM drizzle.__drizzle_migrations
WHERE hash = 'faa424d956d194445f882b036778ec8f00822580c5a8edfe69d9a458b0fc26b7'
  AND created_at = 1788143210743;
