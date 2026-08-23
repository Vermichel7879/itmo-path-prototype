-- PHASE 2.5 schema upgrade. Run once in Supabase SQL Editor.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.config_versions') IS NULL
     OR to_regclass('public.modules') IS NULL
     OR to_regclass('public.modifiers') IS NULL
     OR to_regclass('public.recommendations') IS NULL THEN
    RAISE EXCEPTION 'Prerequisite PHASE 2 schema is missing';
  END IF;
  IF (SELECT count(*) FROM config_versions WHERE status = 'DRAFT') <> 1
     OR (SELECT count(*) FROM config_versions WHERE status = 'PUBLISHED') <> 0 THEN
    RAISE EXCEPTION 'Expected exactly one DRAFT and zero PUBLISHED configs';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM config_versions
    WHERE status = 'DRAFT'
      AND id = 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid
  ) THEN
    RAISE EXCEPTION 'Unexpected DRAFT config id';
  END IF;
  IF to_regclass('public.engine_rules') IS NOT NULL
     OR to_regclass('public.documentation_examples') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engine_rule_kind')
     OR EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modifier_operation_kind')
     OR EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'modifiers'
         AND column_name IN ('operation_kind', 'operation_params')
     )
     OR EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'modules'
         AND column_name = 'sort_order'
     )
     OR EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'recommendations'
         AND column_name = 'priority_tags'
     ) THEN
    RAISE EXCEPTION 'Typed-rules schema objects already exist or upgrade is partial';
  END IF;
END;
$$;

CREATE TYPE "public"."engine_rule_kind" AS ENUM('WEIGHTED_SCORING', 'TIE_BREAK', 'RESULT_COMPOSITION', 'SUPPORT_SELECTION', 'MODIFIER_APPLICATION', 'RECOMMENDATION_SELECTION', 'RECOMMENDATION_PREFERENCE', 'PRIORITY_CAPTURE', 'PACE_MAPPING', 'RECOMMENDATION_DEDUPLICATION', 'CONTENT_POLICY', 'MODULE_GUARD', 'CONDITIONAL_BRANCH', 'ENTREPRENEUR_COMPOSITION', 'FALLBACK_SELECTION');
CREATE TYPE "public"."modifier_operation_kind" AS ENUM('REPLACE_STEP', 'APPEND_ADJUSTMENT', 'SET_PRIORITIES', 'SET_PACE', 'REPLACE_M11_STAGE', 'APPEND_M11_CHALLENGE');

CREATE TABLE "documentation_examples" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "config_version_id" uuid NOT NULL,
  "stable_id" varchar(40) NOT NULL,
  "input_summary" text NOT NULL,
  "expected_module_summary" text NOT NULL,
  "primary_focus" text NOT NULL,
  "steps_summary" text NOT NULL,
  "recommendations_summary" text NOT NULL,
  "sort_order" integer NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "documentation_examples_sort_positive" CHECK ("documentation_examples"."sort_order" > 0),
  CONSTRAINT "documentation_examples_stable_id_format" CHECK ("documentation_examples"."stable_id" ~ '^E0[1-7]$')
);

CREATE TABLE "engine_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "config_version_id" uuid NOT NULL,
  "stable_id" varchar(40) NOT NULL,
  "rule_kind" "engine_rule_kind" NOT NULL,
  "params" jsonb NOT NULL,
  "source_title" text NOT NULL,
  "source_content" text NOT NULL,
  "sort_order" integer NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "engine_rules_sort_positive" CHECK ("engine_rules"."sort_order" > 0),
  CONSTRAINT "engine_rules_stable_id_format" CHECK ("engine_rules"."stable_id" ~ '^R(0[1-9]|1[0-7])$'),
  CONSTRAINT "engine_rules_source_not_blank" CHECK (length(trim("engine_rules"."source_title")) > 0 AND length(trim("engine_rules"."source_content")) > 0)
);

ALTER TABLE "modifiers" ADD COLUMN "operation_kind" "modifier_operation_kind";
ALTER TABLE "modifiers" ADD COLUMN "operation_params" jsonb;
ALTER TABLE "modules" ADD COLUMN "sort_order" integer;
ALTER TABLE "recommendations" ADD COLUMN "priority_tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "documentation_examples" ADD CONSTRAINT "documentation_examples_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "engine_rules" ADD CONSTRAINT "engine_rules_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "documentation_examples_version_stable_unique" ON "documentation_examples" USING btree ("config_version_id", "stable_id");
CREATE UNIQUE INDEX "documentation_examples_version_sort_unique" ON "documentation_examples" USING btree ("config_version_id", "sort_order");
CREATE UNIQUE INDEX "engine_rules_version_stable_unique" ON "engine_rules" USING btree ("config_version_id", "stable_id");
CREATE UNIQUE INDEX "engine_rules_version_sort_unique" ON "engine_rules" USING btree ("config_version_id", "sort_order");
CREATE INDEX "engine_rules_version_kind_idx" ON "engine_rules" USING btree ("config_version_id", "rule_kind");
CREATE UNIQUE INDEX "modules_version_sort_unique" ON "modules" USING btree ("config_version_id", "sort_order");
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_operation_complete" CHECK (("modifiers"."operation_kind" IS NULL AND "modifiers"."operation_params" IS NULL) OR ("modifiers"."operation_kind" IS NOT NULL AND "modifiers"."operation_params" IS NOT NULL));
ALTER TABLE "modules" ADD CONSTRAINT "modules_sort_positive" CHECK ("modules"."sort_order" IS NULL OR "modules"."sort_order" > 0);

COMMIT;

SELECT
  to_regclass('public.engine_rules') IS NOT NULL AS engine_rules_exists,
  to_regclass('public.documentation_examples') IS NOT NULL AS documentation_examples_exists,
  (SELECT count(*) FROM engine_rules) AS engine_rules,
  (SELECT count(*) FROM documentation_examples) AS documentation_examples;
