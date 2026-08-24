-- PHASE 4 schema upgrade, chunk 03. Run once after 02-version-opportunities.sql.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.admin_login_attempts') IS NULL
     OR to_regclass('public.opportunities_version_stable_unique') IS NULL THEN
    RAISE EXCEPTION 'Chunks 01 and 02 have not been applied';
  END IF;
  IF to_regprocedure(
    'public.read_published_config_snapshot_chunk(uuid,integer,integer)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'Published snapshot reader already exists or upgrade is partial';
  END IF;
END;
$$;

CREATE FUNCTION "read_published_config_snapshot_chunk"(
  "p_config_version_id" uuid,
  "p_chunk_offset" integer,
  "p_chunk_length" integer
)
RETURNS TABLE("chunk_text" text, "total_chars" integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    substring(cv.snapshot::text FROM p_chunk_offset + 1 FOR p_chunk_length),
    char_length(cv.snapshot::text)::integer
  FROM config_versions AS cv
  WHERE cv.id = p_config_version_id
    AND cv.status = 'PUBLISHED'
    AND p_chunk_offset >= 0
    AND p_chunk_length BETWEEN 1 AND 4096
$$;

COMMIT;

SELECT
  '03' AS chunk,
  to_regprocedure(
    'public.read_published_config_snapshot_chunk(uuid,integer,integer)'
  ) IS NOT NULL AS published_snapshot_reader_exists;
