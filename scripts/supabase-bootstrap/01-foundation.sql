-- Supabase SQL Editor chunk 01: types, administration, and configuration
-- Run this file once, only after the preceding chunk succeeded.

BEGIN;

CREATE TYPE "public"."admin_role" AS ENUM('ADMIN', 'EDITOR');

CREATE TYPE "public"."config_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "public"."modifier_target_scope" AS ENUM('MODULE', 'ALL');

CREATE TYPE "public"."modifier_type" AS ENUM('COPY', 'PACE');

CREATE TYPE "public"."opportunity_type" AS ENUM('EVENT', 'CLUB', 'FACULTY', 'PRACTICE', 'INTERNSHIP', 'OTHER');

CREATE TYPE "public"."question_selection_type" AS ENUM('SINGLE', 'MULTI');

CREATE TYPE "public"."recommendation_status" AS ENUM('ACTIVE', 'SLOT', 'INACTIVE');

CREATE TYPE "public"."recommendation_type" AS ENUM('CKO_SERVICE', 'EVENT', 'CLUB', 'FACULTY', 'GENERAL');

CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "admin_sessions_token_hash_not_blank" CHECK (length(trim("admin_sessions"."token_hash")) >= 32)
);

CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(120) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "admin_role" DEFAULT 'EDITOR' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_username_not_blank" CHECK (length(trim("admin_users"."username")) > 0),
	CONSTRAINT "admin_users_password_hash_not_blank" CHECK (length(trim("admin_users"."password_hash")) > 0)
);

CREATE TABLE "config_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_number" integer NOT NULL,
	"status" "config_status" DEFAULT 'DRAFT' NOT NULL,
	"label" varchar(180),
	"source_file_name" text,
	"source_sha256" varchar(64),
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_admin_user_id" uuid,
	"published_by_admin_user_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "config_versions_number_positive" CHECK ("config_versions"."version_number" > 0),
	CONSTRAINT "config_versions_publish_metadata" CHECK (("config_versions"."status" <> 'PUBLISHED') OR ("config_versions"."published_at" IS NOT NULL)),
	CONSTRAINT "config_versions_source_hash_format" CHECK ("config_versions"."source_sha256" IS NULL OR "config_versions"."source_sha256" ~ '^[A-F0-9]{64}$')
);

ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "config_versions" ADD CONSTRAINT "config_versions_created_by_admin_user_id_admin_users_id_fk" FOREIGN KEY ("created_by_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "config_versions" ADD CONSTRAINT "config_versions_published_by_admin_user_id_admin_users_id_fk" FOREIGN KEY ("published_by_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX "admin_sessions_token_hash_unique" ON "admin_sessions" USING btree ("token_hash");

CREATE INDEX "admin_sessions_user_idx" ON "admin_sessions" USING btree ("user_id");

CREATE INDEX "admin_sessions_expiry_idx" ON "admin_sessions" USING btree ("expires_at");

CREATE UNIQUE INDEX "admin_users_username_unique" ON "admin_users" USING btree ("username");

CREATE INDEX "admin_users_active_idx" ON "admin_users" USING btree ("active");

CREATE UNIQUE INDEX "config_versions_number_unique" ON "config_versions" USING btree ("version_number");

CREATE UNIQUE INDEX "config_versions_single_draft_unique" ON "config_versions" USING btree ("status") WHERE "config_versions"."status" = 'DRAFT';

CREATE INDEX "config_versions_published_idx" ON "config_versions" USING btree ("status","published_at");

COMMIT;

-- Read-only verification for this chunk.
SELECT
  '01' AS chunk,
  (
    SELECT count(*)::integer
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name IN ('admin_users', 'admin_sessions', 'config_versions')
  ) AS expected_objects_found,
  3 AS expected_objects_total,
  (
    SELECT count(*)::integer
    FROM pg_type AS type
    JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public'
      AND type.typname IN (
        'admin_role',
        'config_status',
        'modifier_target_scope',
        'modifier_type',
        'opportunity_type',
        'question_selection_type',
        'recommendation_status',
        'recommendation_type'
      )
  ) AS enum_types_found,
  8 AS enum_types_total;
