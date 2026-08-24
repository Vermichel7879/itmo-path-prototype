CREATE TABLE "admin_login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"username_hash" varchar(64) NOT NULL,
	"ip_hash" varchar(64) NOT NULL,
	"succeeded" boolean DEFAULT false NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_login_attempts_username_hash_format" CHECK ("admin_login_attempts"."username_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "admin_login_attempts_ip_hash_format" CHECK ("admin_login_attempts"."ip_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
DROP INDEX "opportunities_stable_unique";--> statement-breakpoint
DROP INDEX "opportunities_type_active_idx";--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "config_version_id" uuid NOT NULL;--> statement-breakpoint
CREATE INDEX "admin_login_attempts_username_time_idx" ON "admin_login_attempts" USING btree ("username_hash","attempted_at");--> statement-breakpoint
CREATE INDEX "admin_login_attempts_ip_time_idx" ON "admin_login_attempts" USING btree ("ip_hash","attempted_at");--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_version_stable_unique" ON "opportunities" USING btree ("config_version_id","stable_id");--> statement-breakpoint
CREATE INDEX "opportunities_version_type_active_idx" ON "opportunities" USING btree ("config_version_id","type","active");--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_id_version_unique" UNIQUE("id","config_version_id");
--> statement-breakpoint
CREATE FUNCTION "read_published_config_snapshot_chunk"(
	"p_config_version_id" uuid,
	"p_chunk_offset" integer,
	"p_chunk_length" integer
)
RETURNS TABLE("chunk_text" text, "total_chars" integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
	SELECT
		substring(cv.snapshot::text FROM p_chunk_offset + 1 FOR p_chunk_length),
		char_length(cv.snapshot::text)::integer
	FROM config_versions AS cv
	WHERE cv.id = p_config_version_id
		AND cv.status = 'PUBLISHED'
		AND p_chunk_offset >= 0
		AND p_chunk_length BETWEEN 1 AND 4096
$$;
