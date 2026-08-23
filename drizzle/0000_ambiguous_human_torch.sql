CREATE TYPE "public"."admin_role" AS ENUM('ADMIN', 'EDITOR');--> statement-breakpoint
CREATE TYPE "public"."config_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."modifier_target_scope" AS ENUM('MODULE', 'ALL');--> statement-breakpoint
CREATE TYPE "public"."modifier_type" AS ENUM('COPY', 'PACE');--> statement-breakpoint
CREATE TYPE "public"."opportunity_type" AS ENUM('EVENT', 'CLUB', 'FACULTY', 'PRACTICE', 'INTERNSHIP', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."question_selection_type" AS ENUM('SINGLE', 'MULTI');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('ACTIVE', 'SLOT', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."recommendation_type" AS ENUM('CKO_SERVICE', 'EVENT', 'CLUB', 'FACULTY', 'GENERAL');--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "admin_sessions_token_hash_not_blank" CHECK (length(trim("admin_sessions"."token_hash")) >= 32)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "answer_module_weights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" uuid NOT NULL,
	"answer_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"weight" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "module_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_recommendations_priority_positive" CHECK ("module_recommendations"."priority" > 0)
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_module_weights" ADD CONSTRAINT "answer_module_weights_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_module_weights" ADD CONSTRAINT "answer_module_weights_answer_version_fk" FOREIGN KEY ("answer_id","config_version_id") REFERENCES "public"."answers"("id","config_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_module_weights" ADD CONSTRAINT "answer_module_weights_module_version_fk" FOREIGN KEY ("module_id","config_version_id") REFERENCES "public"."modules"("id","config_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_version_fk" FOREIGN KEY ("question_id","config_version_id") REFERENCES "public"."questions"("id","config_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_admin_user_id_admin_users_id_fk" FOREIGN KEY ("actor_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_versions" ADD CONSTRAINT "config_versions_created_by_admin_user_id_admin_users_id_fk" FOREIGN KEY ("created_by_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_versions" ADD CONSTRAINT "config_versions_published_by_admin_user_id_admin_users_id_fk" FOREIGN KEY ("published_by_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrepreneur_challenges" ADD CONSTRAINT "entrepreneur_challenges_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrepreneur_challenges" ADD CONSTRAINT "entrepreneur_challenges_answer_version_fk" FOREIGN KEY ("answer_id","config_version_id") REFERENCES "public"."answers"("id","config_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrepreneur_challenges" ADD CONSTRAINT "entrepreneur_challenges_module_version_fk" FOREIGN KEY ("target_module_id","config_version_id") REFERENCES "public"."modules"("id","config_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrepreneur_challenges" ADD CONSTRAINT "entrepreneur_challenges_recommendation_version_fk" FOREIGN KEY ("recommendation_id","config_version_id") REFERENCES "public"."recommendations"("id","config_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrepreneur_stages" ADD CONSTRAINT "entrepreneur_stages_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrepreneur_stages" ADD CONSTRAINT "entrepreneur_stages_answer_version_fk" FOREIGN KEY ("answer_id","config_version_id") REFERENCES "public"."answers"("id","config_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrepreneur_stages" ADD CONSTRAINT "entrepreneur_stages_module_version_fk" FOREIGN KEY ("target_module_id","config_version_id") REFERENCES "public"."modules"("id","config_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_answer_version_fk" FOREIGN KEY ("trigger_answer_id","config_version_id") REFERENCES "public"."answers"("id","config_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_module_version_fk" FOREIGN KEY ("target_module_id","config_version_id") REFERENCES "public"."modules"("id","config_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_recommendations" ADD CONSTRAINT "module_recommendations_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_recommendations" ADD CONSTRAINT "module_recommendations_module_version_fk" FOREIGN KEY ("module_id","config_version_id") REFERENCES "public"."modules"("id","config_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_recommendations" ADD CONSTRAINT "module_recommendations_recommendation_version_fk" FOREIGN KEY ("recommendation_id","config_version_id") REFERENCES "public"."recommendations"("id","config_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_token_hash_unique" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_user_idx" ON "admin_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "admin_sessions_expiry_idx" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_username_unique" ON "admin_users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "admin_users_active_idx" ON "admin_users" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "answer_module_weights_unique" ON "answer_module_weights" USING btree ("config_version_id","answer_id","module_id");--> statement-breakpoint
CREATE INDEX "answer_module_weights_answer_idx" ON "answer_module_weights" USING btree ("answer_id");--> statement-breakpoint
CREATE INDEX "answer_module_weights_module_idx" ON "answer_module_weights" USING btree ("module_id");--> statement-breakpoint
CREATE UNIQUE INDEX "answers_version_stable_unique" ON "answers" USING btree ("config_version_id","stable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "answers_question_sort_unique" ON "answers" USING btree ("question_id","sort_order");--> statement-breakpoint
CREATE INDEX "answers_version_active_idx" ON "answers" USING btree ("config_version_id","active");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_admin_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_config_idx" ON "audit_log" USING btree ("config_version_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "config_versions_number_unique" ON "config_versions" USING btree ("version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "config_versions_single_draft_unique" ON "config_versions" USING btree ("status") WHERE "config_versions"."status" = 'DRAFT';--> statement-breakpoint
CREATE INDEX "config_versions_published_idx" ON "config_versions" USING btree ("status","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entrepreneur_challenges_version_stable_unique" ON "entrepreneur_challenges" USING btree ("config_version_id","stable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entrepreneur_challenges_answer_unique" ON "entrepreneur_challenges" USING btree ("config_version_id","answer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entrepreneur_stages_version_stable_unique" ON "entrepreneur_stages" USING btree ("config_version_id","stable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entrepreneur_stages_answer_unique" ON "entrepreneur_stages" USING btree ("config_version_id","answer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "modifiers_version_stable_unique" ON "modifiers" USING btree ("config_version_id","stable_id");--> statement-breakpoint
CREATE INDEX "modifiers_trigger_idx" ON "modifiers" USING btree ("trigger_answer_id");--> statement-breakpoint
CREATE INDEX "modifiers_target_idx" ON "modifiers" USING btree ("target_module_id");--> statement-breakpoint
CREATE UNIQUE INDEX "module_recommendations_unique" ON "module_recommendations" USING btree ("config_version_id","module_id","recommendation_id");--> statement-breakpoint
CREATE INDEX "module_recommendations_module_priority_idx" ON "module_recommendations" USING btree ("module_id","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "modules_version_stable_unique" ON "modules" USING btree ("config_version_id","stable_id");--> statement-breakpoint
CREATE INDEX "modules_version_active_idx" ON "modules" USING btree ("config_version_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_stable_unique" ON "opportunities" USING btree ("stable_id");--> statement-breakpoint
CREATE INDEX "opportunities_type_active_idx" ON "opportunities" USING btree ("type","active");--> statement-breakpoint
CREATE INDEX "opportunities_validity_idx" ON "opportunities" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_version_stable_unique" ON "questions" USING btree ("config_version_id","stable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_version_sort_unique" ON "questions" USING btree ("config_version_id","sort_order");--> statement-breakpoint
CREATE INDEX "questions_version_active_idx" ON "questions" USING btree ("config_version_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendations_version_stable_unique" ON "recommendations" USING btree ("config_version_id","stable_id");--> statement-breakpoint
CREATE INDEX "recommendations_type_active_idx" ON "recommendations" USING btree ("type","active");