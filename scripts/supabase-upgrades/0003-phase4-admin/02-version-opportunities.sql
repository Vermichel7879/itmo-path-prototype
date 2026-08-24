-- PHASE 4 schema upgrade, chunk 02. Run once after 01-login-throttle.sql.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.admin_login_attempts') IS NULL THEN
    RAISE EXCEPTION 'Chunk 01 has not been applied';
  END IF;
  IF to_regclass('public.opportunities') IS NULL
     OR to_regclass('public.config_versions') IS NULL THEN
    RAISE EXCEPTION 'Opportunity versioning prerequisites are missing';
  END IF;
  IF (SELECT count(*) FROM opportunities) <> 0 THEN
    RAISE EXCEPTION 'Expected empty opportunities before adding required config_version_id';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'config_version_id'
  ) THEN
    RAISE EXCEPTION 'opportunities.config_version_id already exists or upgrade is partial';
  END IF;
  IF to_regclass('public.opportunities_stable_unique') IS NULL
     OR to_regclass('public.opportunities_type_active_idx') IS NULL THEN
    RAISE EXCEPTION 'Expected pre-upgrade opportunity indexes are missing';
  END IF;
END;
$$;

DROP INDEX "opportunities_stable_unique";
DROP INDEX "opportunities_type_active_idx";
ALTER TABLE "opportunities" ADD COLUMN "config_version_id" uuid NOT NULL;
ALTER TABLE "opportunities"
  ADD CONSTRAINT "opportunities_config_version_id_config_versions_id_fk"
  FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id")
  ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "opportunities_version_stable_unique"
  ON "opportunities" USING btree ("config_version_id", "stable_id");
CREATE INDEX "opportunities_version_type_active_idx"
  ON "opportunities" USING btree ("config_version_id", "type", "active");
ALTER TABLE "opportunities"
  ADD CONSTRAINT "opportunities_id_version_unique"
  UNIQUE("id", "config_version_id");

COMMIT;

SELECT
  '02' AS chunk,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'config_version_id'
      AND is_nullable = 'NO'
  ) AS opportunities_versioned,
  (SELECT count(*) FROM opportunities) AS opportunities;
