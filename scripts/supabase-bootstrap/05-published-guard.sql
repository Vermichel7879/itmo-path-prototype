-- Supabase SQL Editor chunk 05: published configuration immutability guard
-- Run this file once, only after the preceding chunk succeeded.

BEGIN;

ALTER TABLE "config_versions" ADD CONSTRAINT "config_versions_published_snapshot" CHECK (("config_versions"."status" <> 'PUBLISHED') OR ("config_versions"."snapshot" <> '{}'::jsonb));

CREATE FUNCTION "prevent_published_config_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published configuration versions are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "config_versions_published_immutable"
BEFORE UPDATE OR DELETE ON "config_versions"
FOR EACH ROW
EXECUTE FUNCTION "prevent_published_config_mutation"();

COMMIT;

-- Read-only verification for this chunk.
SELECT
  '05' AS chunk,
  (
    CASE WHEN EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'config_versions_published_snapshot'
        AND conrelid = 'public.config_versions'::regclass
    ) THEN 1 ELSE 0 END
    + CASE WHEN to_regprocedure('public.prevent_published_config_mutation()') IS NOT NULL
      THEN 1 ELSE 0 END
    + CASE WHEN EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'config_versions_published_immutable'
        AND tgrelid = 'public.config_versions'::regclass
        AND NOT tgisinternal
    ) THEN 1 ELSE 0 END
  )::integer AS expected_objects_found,
  3 AS expected_objects_total;
