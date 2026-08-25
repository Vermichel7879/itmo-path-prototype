-- Register 0004 only after RPC and privilege chunks 01-05 succeeded.
BEGIN;

DO $$
DECLARE
  v_required_functions text[] := ARRAY[
    'public.admin_get_login_context(text,text,text,timestamptz)',
    'public.admin_record_failed_login(text,text,timestamptz)',
    'public.admin_complete_login(uuid,text,timestamptz,text,text,timestamptz)',
    'public.admin_resolve_session(text,timestamptz)',
    'public.admin_revoke_session(text,timestamptz)',
    'public.admin_get_user_auth(uuid)',
    'public.admin_change_password(uuid,text,timestamptz)',
    'public.admin_list_users()',
    'public.admin_mutate_user(uuid,text,jsonb)',
    'public.admin_get_draft()',
    'public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb,jsonb)',
    'public.admin_publish_draft(uuid,timestamptz,text,text)',
    'public.admin_get_latest_published_summary()',
    'public.admin_get_latest_published_snapshot()',
    'public.admin_list_versions()',
    'public.admin_list_audit(text,text,text,timestamptz,timestamptz)'
  ];
  v_function text;
BEGIN
  FOREACH v_function IN ARRAY v_required_functions LOOP
    IF to_regprocedure(v_function) IS NULL THEN
      RAISE EXCEPTION 'Admin Data API RPC upgrade is incomplete';
    END IF;
    IF NOT has_function_privilege('service_role', v_function, 'EXECUTE')
       OR has_function_privilege('anon', v_function, 'EXECUTE')
       OR has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'Admin Data API RPC privileges are incomplete';
    END IF;
  END LOOP;

  IF to_regclass('drizzle.__drizzle_migrations') IS NULL
     OR (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 4 THEN
    RAISE EXCEPTION 'Expected exactly four existing Drizzle migration records';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = '47a26deb9246aef1d9cb19bfd3bb8996c381d022b4d1c819d1e313a24606ef7a'
       OR created_at = 1787588242530
  ) THEN
    RAISE EXCEPTION 'Migration 0004 is already registered or history conflicts';
  END IF;
END;
$$;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES (
  '47a26deb9246aef1d9cb19bfd3bb8996c381d022b4d1c819d1e313a24606ef7a',
  1787588242530
);

COMMIT;

SELECT count(*) AS drizzle_migration_records
FROM drizzle.__drizzle_migrations;
