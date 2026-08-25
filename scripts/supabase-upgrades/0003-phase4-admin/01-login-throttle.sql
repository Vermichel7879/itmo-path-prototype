-- PHASE 4 schema upgrade, chunk 01. Run once in Supabase SQL Editor.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.admin_users') IS NULL
     OR to_regclass('public.admin_sessions') IS NULL
     OR to_regclass('public.audit_log') IS NULL THEN
    RAISE EXCEPTION 'PHASE 4 auth prerequisites are missing';
  END IF;
  IF to_regclass('public.admin_login_attempts') IS NOT NULL THEN
    RAISE EXCEPTION 'admin_login_attempts already exists or upgrade is partial';
  END IF;
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL
     OR (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 3 THEN
    RAISE EXCEPTION 'Expected exactly three existing Drizzle migrations';
  END IF;
END;
$$;

CREATE TABLE "admin_login_attempts" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "username_hash" varchar(64) NOT NULL,
  "ip_hash" varchar(64) NOT NULL,
  "succeeded" boolean DEFAULT false NOT NULL,
  "attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "admin_login_attempts_username_hash_format"
    CHECK ("admin_login_attempts"."username_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "admin_login_attempts_ip_hash_format"
    CHECK ("admin_login_attempts"."ip_hash" ~ '^[a-f0-9]{64}$')
);

CREATE INDEX "admin_login_attempts_username_time_idx"
  ON "admin_login_attempts" USING btree ("username_hash", "attempted_at");
CREATE INDEX "admin_login_attempts_ip_time_idx"
  ON "admin_login_attempts" USING btree ("ip_hash", "attempted_at");

COMMIT;

SELECT
  '01' AS chunk,
  to_regclass('public.admin_login_attempts') IS NOT NULL
    AS admin_login_attempts_exists,
  (SELECT count(*) FROM admin_login_attempts) AS login_attempt_records;
