CREATE TYPE "public"."engine_rule_kind" AS ENUM('WEIGHTED_SCORING', 'TIE_BREAK', 'RESULT_COMPOSITION', 'SUPPORT_SELECTION', 'MODIFIER_APPLICATION', 'RECOMMENDATION_SELECTION', 'RECOMMENDATION_PREFERENCE', 'PRIORITY_CAPTURE', 'PACE_MAPPING', 'RECOMMENDATION_DEDUPLICATION', 'CONTENT_POLICY', 'MODULE_GUARD', 'CONDITIONAL_BRANCH', 'ENTREPRENEUR_COMPOSITION', 'FALLBACK_SELECTION');--> statement-breakpoint
CREATE TYPE "public"."modifier_operation_kind" AS ENUM('REPLACE_STEP', 'APPEND_ADJUSTMENT', 'SET_PRIORITIES', 'SET_PACE', 'REPLACE_M11_STAGE', 'APPEND_M11_CHALLENGE');--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "modifiers" ADD COLUMN "operation_kind" "modifier_operation_kind";--> statement-breakpoint
ALTER TABLE "modifiers" ADD COLUMN "operation_params" jsonb;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "sort_order" integer;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "priority_tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "documentation_examples" ADD CONSTRAINT "documentation_examples_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engine_rules" ADD CONSTRAINT "engine_rules_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documentation_examples_version_stable_unique" ON "documentation_examples" USING btree ("config_version_id","stable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documentation_examples_version_sort_unique" ON "documentation_examples" USING btree ("config_version_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "engine_rules_version_stable_unique" ON "engine_rules" USING btree ("config_version_id","stable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "engine_rules_version_sort_unique" ON "engine_rules" USING btree ("config_version_id","sort_order");--> statement-breakpoint
CREATE INDEX "engine_rules_version_kind_idx" ON "engine_rules" USING btree ("config_version_id","rule_kind");--> statement-breakpoint
CREATE UNIQUE INDEX "modules_version_sort_unique" ON "modules" USING btree ("config_version_id","sort_order");--> statement-breakpoint
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_operation_complete" CHECK (("modifiers"."operation_kind" IS NULL AND "modifiers"."operation_params" IS NULL) OR ("modifiers"."operation_kind" IS NOT NULL AND "modifiers"."operation_params" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_sort_positive" CHECK ("modules"."sort_order" IS NULL OR "modules"."sort_order" > 0);