SELECT
  to_regprocedure('public.public_replace_session_answer_set(uuid,jsonb)') IS NOT NULL
    AS batch_answer_rpc_exists,
  to_regprocedure('public.public_replace_session_answers(uuid,text,jsonb)') IS NOT NULL
    AS legacy_single_answer_rpc_exists,
  has_function_privilege('service_role', 'public.public_replace_session_answer_set(uuid,jsonb)', 'EXECUTE')
    AS service_role_execute,
  NOT has_function_privilege('anon', 'public.public_replace_session_answer_set(uuid,jsonb)', 'EXECUTE')
    AS anon_execute_denied,
  NOT has_function_privilege('authenticated', 'public.public_replace_session_answer_set(uuid,jsonb)', 'EXECUTE')
    AS authenticated_execute_denied,
  (
    SELECT count(*) = 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = 'b1ecf4d3bd2f752d533239a38dbbd85d5921c434fff8cfe217fd99876de06474'
      AND created_at = 1788216608454
  ) AS migration_0010_registered_once,
  (
    SELECT count(*)
    FROM drizzle.__drizzle_migrations
  ) AS drizzle_migration_records;
