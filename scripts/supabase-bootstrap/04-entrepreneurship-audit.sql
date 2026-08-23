-- Supabase SQL Editor chunk 04: opportunities, entrepreneurship, and audit
-- Run this file once, only after the preceding chunk succeeded.

BEGIN;

CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_admin_user_id" uuid,
	"config_version_id" uuid,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(120) NOT NULL,
	"entity_id" varchar(160),
	"previous_value" jsonb,
	"new_value" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "entrepreneur_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" uuid NOT NULL,
	"stable_id" varchar(80) NOT NULL,
	"answer_id" uuid NOT NULL,
	"target_module_id" uuid NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"answer_text" text NOT NULL,
	"trajectory_adjustment" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entrepreneur_challenges_id_version_unique" UNIQUE("id","config_version_id"),
	CONSTRAINT "entrepreneur_challenges_sort_positive" CHECK ("entrepreneur_challenges"."sort_order" > 0)
);

CREATE TABLE "entrepreneur_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" uuid NOT NULL,
	"stable_id" varchar(80) NOT NULL,
	"answer_id" uuid NOT NULL,
	"target_module_id" uuid NOT NULL,
	"answer_text" text NOT NULL,
	"focus" text NOT NULL,
	"step_1" text NOT NULL,
	"step_2" text NOT NULL,
	"step_3" text NOT NULL,
	"checkpoint" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entrepreneur_stages_id_version_unique" UNIQUE("id","config_version_id"),
	CONSTRAINT "entrepreneur_stages_sort_positive" CHECK ("entrepreneur_stages"."sort_order" > 0)
);

CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stable_id" varchar(100) NOT NULL,
	"type" "opportunity_type" NOT NULL,
	"title" varchar(280) NOT NULL,
	"description" text NOT NULL,
	"url" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunities_date_order" CHECK ("opportunities"."starts_at" IS NULL OR "opportunities"."ends_at" IS NULL OR "opportunities"."starts_at" <= "opportunities"."ends_at"),
	CONSTRAINT "opportunities_validity_order" CHECK ("opportunities"."valid_from" IS NULL OR "opportunities"."valid_to" IS NULL OR "opportunities"."valid_from" <= "opportunities"."valid_to")
);

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_admin_user_id_admin_users_id_fk" FOREIGN KEY ("actor_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "entrepreneur_challenges" ADD CONSTRAINT "entrepreneur_challenges_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "entrepreneur_challenges" ADD CONSTRAINT "entrepreneur_challenges_answer_version_fk" FOREIGN KEY ("answer_id","config_version_id") REFERENCES "public"."answers"("id","config_version_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "entrepreneur_challenges" ADD CONSTRAINT "entrepreneur_challenges_module_version_fk" FOREIGN KEY ("target_module_id","config_version_id") REFERENCES "public"."modules"("id","config_version_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "entrepreneur_challenges" ADD CONSTRAINT "entrepreneur_challenges_recommendation_version_fk" FOREIGN KEY ("recommendation_id","config_version_id") REFERENCES "public"."recommendations"("id","config_version_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "entrepreneur_stages" ADD CONSTRAINT "entrepreneur_stages_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "entrepreneur_stages" ADD CONSTRAINT "entrepreneur_stages_answer_version_fk" FOREIGN KEY ("answer_id","config_version_id") REFERENCES "public"."answers"("id","config_version_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "entrepreneur_stages" ADD CONSTRAINT "entrepreneur_stages_module_version_fk" FOREIGN KEY ("target_module_id","config_version_id") REFERENCES "public"."modules"("id","config_version_id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_admin_user_id","created_at");

CREATE INDEX "audit_log_config_idx" ON "audit_log" USING btree ("config_version_id","created_at");

CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");

CREATE UNIQUE INDEX "entrepreneur_challenges_version_stable_unique" ON "entrepreneur_challenges" USING btree ("config_version_id","stable_id");

CREATE UNIQUE INDEX "entrepreneur_challenges_answer_unique" ON "entrepreneur_challenges" USING btree ("config_version_id","answer_id");

CREATE UNIQUE INDEX "entrepreneur_stages_version_stable_unique" ON "entrepreneur_stages" USING btree ("config_version_id","stable_id");

CREATE UNIQUE INDEX "entrepreneur_stages_answer_unique" ON "entrepreneur_stages" USING btree ("config_version_id","answer_id");

CREATE UNIQUE INDEX "opportunities_stable_unique" ON "opportunities" USING btree ("stable_id");

CREATE INDEX "opportunities_type_active_idx" ON "opportunities" USING btree ("type","active");

CREATE INDEX "opportunities_validity_idx" ON "opportunities" USING btree ("valid_from","valid_to");

COMMIT;

-- Read-only verification for this chunk.
SELECT
  '04' AS chunk,
  (
    SELECT count(*)::integer
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name IN ('opportunities', 'entrepreneur_stages', 'entrepreneur_challenges', 'audit_log')
  ) AS expected_objects_found,
  4 AS expected_objects_total;
