SELECT
  to_regprocedure('public.public_get_pinned_questionnaire(uuid,public.education_level)') IS NOT NULL
    AS pinned_questionnaire_rpc_exists,
  to_regprocedure('public.public_get_pinned_engine_config(uuid)') IS NOT NULL
    AS pinned_engine_config_rpc_exists,
  has_function_privilege('service_role', 'public.public_get_pinned_questionnaire(uuid,public.education_level)', 'EXECUTE')
    AS service_role_questionnaire_rpc_grant,
  has_function_privilege('service_role', 'public.public_get_pinned_engine_config(uuid)', 'EXECUTE')
    AS service_role_engine_rpc_grant,
  NOT has_function_privilege('anon', 'public.public_get_pinned_questionnaire(uuid,public.education_level)', 'EXECUTE')
    AS anon_questionnaire_rpc_denied,
  NOT has_function_privilege('anon', 'public.public_get_pinned_engine_config(uuid)', 'EXECUTE')
    AS anon_engine_rpc_denied,
  NOT has_function_privilege('authenticated', 'public.public_get_pinned_questionnaire(uuid,public.education_level)', 'EXECUTE')
    AS authenticated_questionnaire_rpc_denied,
  NOT has_function_privilege('authenticated', 'public.public_get_pinned_engine_config(uuid)', 'EXECUTE')
    AS authenticated_engine_rpc_denied,
  (
    SELECT count(*) = 1
    FROM drizzle.__drizzle_migrations
    WHERE hash = 'faa424d956d194445f882b036778ec8f00822580c5a8edfe69d9a458b0fc26b7'
      AND created_at = 1788143210743
  ) AS migration_0009_registered_once,
  (
    SELECT count(*)
    FROM drizzle.__drizzle_migrations
    WHERE hash = 'faa424d956d194445f882b036778ec8f00822580c5a8edfe69d9a458b0fc26b7'
      AND created_at = 1788143210743
  ) AS migration_0009_records;

SELECT
  version.id AS config_version_id,
  octet_length(public.public_get_pinned_engine_config(version.id)::text) AS engine_config_bytes,
  octet_length(version.snapshot::text) AS full_snapshot_bytes
FROM public.config_versions AS version
WHERE version.status = 'PUBLISHED'
ORDER BY version.published_at DESC NULLS LAST;
