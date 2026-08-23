-- Supabase SQL Editor chunk 03: modifiers and recommendations
-- Run this file once, only after the preceding chunk succeeded.

BEGIN;

CREATE TABLE "modifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" uuid NOT NULL,
	"stable_id" varchar(40) NOT NULL,
	"trigger_answer_id" uuid,
	"trigger_answer_pattern" varchar(80) NOT NULL,
	"trigger_tag" varchar(120),
	"target_scope" "modifier_target_scope" NOT NULL,
	"target_module_id" uuid,
	"type" "modifier_type" NOT NULL,
	"variant_key" varchar(120) NOT NULL,
	"effect" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modifiers_id_version_unique" UNIQUE("id","config_version_id"),
	CONSTRAINT "modifiers_target_scope_consistent" CHECK (("modifiers"."target_scope" = 'ALL' AND "modifiers"."target_module_id" IS NULL) OR ("modifiers"."target_scope" = 'MODULE' AND "modifiers"."target_module_id" IS NOT NULL))
);

CREATE TABLE "module_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_recommendations_priority_positive" CHECK ("module_recommendations"."priority" > 0)
);

CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" uuid NOT NULL,
	"stable_id" varchar(80) NOT NULL,
	"type" "recommendation_type" NOT NULL,
	"title" varchar(280) NOT NULL,
	"description" text NOT NULL,
	"url" text,
	"status" "recommendation_status" DEFAULT 'ACTIVE' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendations_id_version_unique" UNIQUE("id","config_version_id")
);

ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_answer_version_fk" FOREIGN KEY ("trigger_answer_id","config_version_id") REFERENCES "public"."answers"("id","config_version_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_module_version_fk" FOREIGN KEY ("target_module_id","config_version_id") REFERENCES "public"."modules"("id","config_version_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "module_recommendations" ADD CONSTRAINT "module_recommendations_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "module_recommendations" ADD CONSTRAINT "module_recommendations_module_version_fk" FOREIGN KEY ("module_id","config_version_id") REFERENCES "public"."modules"("id","config_version_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "module_recommendations" ADD CONSTRAINT "module_recommendations_recommendation_version_fk" FOREIGN KEY ("recommendation_id","config_version_id") REFERENCES "public"."recommendations"("id","config_version_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "modifiers_version_stable_unique" ON "modifiers" USING btree ("config_version_id","stable_id");

CREATE INDEX "modifiers_trigger_idx" ON "modifiers" USING btree ("trigger_answer_id");

CREATE INDEX "modifiers_target_idx" ON "modifiers" USING btree ("target_module_id");

CREATE UNIQUE INDEX "module_recommendations_unique" ON "module_recommendations" USING btree ("config_version_id","module_id","recommendation_id");

CREATE INDEX "module_recommendations_module_priority_idx" ON "module_recommendations" USING btree ("module_id","priority");

CREATE UNIQUE INDEX "recommendations_version_stable_unique" ON "recommendations" USING btree ("config_version_id","stable_id");

CREATE INDEX "recommendations_type_active_idx" ON "recommendations" USING btree ("type","active");

COMMIT;

-- Read-only verification for this chunk.
SELECT
  '03' AS chunk,
  (
    SELECT count(*)::integer
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name IN ('modifiers', 'recommendations', 'module_recommendations')
  ) AS expected_objects_found,
  3 AS expected_objects_total;
