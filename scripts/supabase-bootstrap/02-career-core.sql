-- Supabase SQL Editor chunk 02: questionnaire, answers, scoring, and modules
-- Run this file once, only after the preceding chunk succeeded.

BEGIN;

CREATE TABLE "answer_module_weights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" uuid NOT NULL,
	"answer_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"weight" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"stable_id" varchar(60) NOT NULL,
	"text" text NOT NULL,
	"sort_order" integer NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answers_id_version_unique" UNIQUE("id","config_version_id"),
	CONSTRAINT "answers_sort_positive" CHECK ("answers"."sort_order" > 0)
);

CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" uuid NOT NULL,
	"stable_id" varchar(40) NOT NULL,
	"name" varchar(240) NOT NULL,
	"goal" text NOT NULL,
	"step_1" text NOT NULL,
	"step_2" text NOT NULL,
	"step_3" text NOT NULL,
	"checkpoint" text NOT NULL,
	"constraints" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modules_id_version_unique" UNIQUE("id","config_version_id")
);

CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" uuid NOT NULL,
	"stable_id" varchar(40) NOT NULL,
	"block" varchar(180) NOT NULL,
	"text" text NOT NULL,
	"selection_type" "question_selection_type" NOT NULL,
	"min_select" integer NOT NULL,
	"max_select" integer NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"sort_order" integer NOT NULL,
	"show_condition" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_id_version_unique" UNIQUE("id","config_version_id"),
	CONSTRAINT "questions_min_nonnegative" CHECK ("questions"."min_select" >= 0),
	CONSTRAINT "questions_max_positive" CHECK ("questions"."max_select" > 0),
	CONSTRAINT "questions_min_lte_max" CHECK ("questions"."min_select" <= "questions"."max_select"),
	CONSTRAINT "questions_required_min" CHECK (NOT "questions"."required" OR "questions"."min_select" >= 1),
	CONSTRAINT "questions_single_max" CHECK ("questions"."selection_type" <> 'SINGLE' OR "questions"."max_select" = 1),
	CONSTRAINT "questions_sort_positive" CHECK ("questions"."sort_order" > 0)
);

ALTER TABLE "answer_module_weights" ADD CONSTRAINT "answer_module_weights_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "answer_module_weights" ADD CONSTRAINT "answer_module_weights_answer_version_fk" FOREIGN KEY ("answer_id","config_version_id") REFERENCES "public"."answers"("id","config_version_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "answer_module_weights" ADD CONSTRAINT "answer_module_weights_module_version_fk" FOREIGN KEY ("module_id","config_version_id") REFERENCES "public"."modules"("id","config_version_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "answers" ADD CONSTRAINT "answers_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "answers" ADD CONSTRAINT "answers_question_version_fk" FOREIGN KEY ("question_id","config_version_id") REFERENCES "public"."questions"("id","config_version_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "modules" ADD CONSTRAINT "modules_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "questions" ADD CONSTRAINT "questions_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "answer_module_weights_unique" ON "answer_module_weights" USING btree ("config_version_id","answer_id","module_id");

CREATE INDEX "answer_module_weights_answer_idx" ON "answer_module_weights" USING btree ("answer_id");

CREATE INDEX "answer_module_weights_module_idx" ON "answer_module_weights" USING btree ("module_id");

CREATE UNIQUE INDEX "answers_version_stable_unique" ON "answers" USING btree ("config_version_id","stable_id");

CREATE UNIQUE INDEX "answers_question_sort_unique" ON "answers" USING btree ("question_id","sort_order");

CREATE INDEX "answers_version_active_idx" ON "answers" USING btree ("config_version_id","active");

CREATE UNIQUE INDEX "modules_version_stable_unique" ON "modules" USING btree ("config_version_id","stable_id");

CREATE INDEX "modules_version_active_idx" ON "modules" USING btree ("config_version_id","active");

CREATE UNIQUE INDEX "questions_version_stable_unique" ON "questions" USING btree ("config_version_id","stable_id");

CREATE UNIQUE INDEX "questions_version_sort_unique" ON "questions" USING btree ("config_version_id","sort_order");

CREATE INDEX "questions_version_active_idx" ON "questions" USING btree ("config_version_id","active");

COMMIT;

-- Read-only verification for this chunk.
SELECT
  '02' AS chunk,
  (
    SELECT count(*)::integer
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name IN ('questions', 'answers', 'answer_module_weights', 'modules')
  ) AS expected_objects_found,
  4 AS expected_objects_total;
