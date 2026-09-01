BEGIN;

DO $$
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL
     OR (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 10 THEN
    RAISE EXCEPTION 'Expected exactly ten existing Drizzle migration records';
  END IF;

  IF to_regprocedure('public.public_replace_session_answer_set(uuid,jsonb)') IS NULL
     OR NOT has_function_privilege('service_role', 'public.public_replace_session_answer_set(uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.public_replace_session_answer_set(uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.public_replace_session_answer_set(uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Batch session answer RPC upgrade is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = 'b1ecf4d3bd2f752d533239a38dbbd85d5921c434fff8cfe217fd99876de06474'
       OR created_at = 1788216608454
  ) THEN
    RAISE EXCEPTION 'Migration 0010 is already registered or history conflicts';
  END IF;
END;
$$;

INSERT INTO drizzle.__drizzle_migrations(hash, created_at)
VALUES ('b1ecf4d3bd2f752d533239a38dbbd85d5921c434fff8cfe217fd99876de06474', 1788216608454);

COMMIT;

SELECT count(*)::integer AS migration_0010_records
FROM drizzle.__drizzle_migrations
WHERE hash = 'b1ecf4d3bd2f752d533239a38dbbd85d5921c434fff8cfe217fd99876de06474'
  AND created_at = 1788216608454;
