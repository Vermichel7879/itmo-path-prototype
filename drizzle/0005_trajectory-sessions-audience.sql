CREATE TYPE "public"."education_level" AS ENUM('BACHELOR', 'MASTER');--> statement-breakpoint
CREATE TYPE "public"."trajectory_module_result_kind" AS ENUM('PRIMARY', 'SUPPORT');--> statement-breakpoint
CREATE TYPE "public"."trajectory_session_status" AS ENUM('IN_PROGRESS', 'COMPLETED', 'UNAVAILABLE');--> statement-breakpoint
CREATE TABLE "session_answers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" varchar(40) NOT NULL,
	"answer_option_id" varchar(60) NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_module_results" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"module_id" varchar(40) NOT NULL,
	"kind" "trajectory_module_result_kind" NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_module_scores" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"module_id" varchar(40) NOT NULL,
	"total_score" integer NOT NULL,
	"final_rank" integer NOT NULL,
	"q2_score" integer DEFAULT 0 NOT NULL,
	"q3_score" integer DEFAULT 0 NOT NULL,
	"q1_score" integer DEFAULT 0 NOT NULL,
	"q5_score" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_recommendations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"recommendation_id" varchar(100) NOT NULL,
	"position" integer NOT NULL,
	"source_module_id" varchar(40)
);
--> statement-breakpoint
CREATE TABLE "session_score_contributions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" varchar(40) NOT NULL,
	"answer_option_id" varchar(60) NOT NULL,
	"module_id" varchar(40) NOT NULL,
	"weight" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trajectory_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isu" text NOT NULL,
	"education_level" "education_level" NOT NULL,
	"config_version_id" uuid NOT NULL,
	"status" "trajectory_session_status" NOT NULL,
	"primary_module_id" varchar(40),
	"result_snapshot" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "trajectory_sessions_isu_digits" CHECK ("trajectory_sessions"."isu" ~ '^[0-9]+$'),
	CONSTRAINT "trajectory_sessions_completion_consistent" CHECK (("trajectory_sessions"."status" = 'COMPLETED' AND "trajectory_sessions"."completed_at" IS NOT NULL AND "trajectory_sessions"."result_snapshot" IS NOT NULL) OR ("trajectory_sessions"."status" <> 'COMPLETED' AND "trajectory_sessions"."completed_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "for_bachelor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "for_master" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "for_bachelor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "for_master" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "for_bachelor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "for_master" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "session_answers" ADD CONSTRAINT "session_answers_session_id_trajectory_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."trajectory_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_module_results" ADD CONSTRAINT "session_module_results_session_id_trajectory_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."trajectory_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_module_scores" ADD CONSTRAINT "session_module_scores_session_id_trajectory_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."trajectory_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_recommendations" ADD CONSTRAINT "session_recommendations_session_id_trajectory_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."trajectory_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_score_contributions" ADD CONSTRAINT "session_score_contributions_session_id_trajectory_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."trajectory_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajectory_sessions" ADD CONSTRAINT "trajectory_sessions_config_version_id_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_answers_selection_unique" ON "session_answers" USING btree ("session_id","question_id","answer_option_id");--> statement-breakpoint
CREATE INDEX "session_answers_session_question_idx" ON "session_answers" USING btree ("session_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_module_results_unique" ON "session_module_results" USING btree ("session_id","kind","position");--> statement-breakpoint
CREATE UNIQUE INDEX "session_module_scores_unique" ON "session_module_scores" USING btree ("session_id","module_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_recommendations_unique" ON "session_recommendations" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "session_score_contributions_session_idx" ON "session_score_contributions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "trajectory_sessions_isu_idx" ON "trajectory_sessions" USING btree ("isu");--> statement-breakpoint
CREATE INDEX "trajectory_sessions_config_idx" ON "trajectory_sessions" USING btree ("config_version_id");--> statement-breakpoint
CREATE INDEX "trajectory_sessions_status_idx" ON "trajectory_sessions" USING btree ("status");--> statement-breakpoint
UPDATE public.config_versions
SET snapshot = jsonb_set(
  jsonb_set(
    jsonb_set(
      snapshot,
      '{questions}',
      COALESCE((SELECT jsonb_agg(item || '{"forBachelor":false,"forMaster":true}'::jsonb) FROM jsonb_array_elements(snapshot -> 'questions') AS item), '[]'::jsonb)
    ),
    '{modules}',
    COALESCE((SELECT jsonb_agg(item || '{"forBachelor":false,"forMaster":true}'::jsonb) FROM jsonb_array_elements(snapshot -> 'modules') AS item), '[]'::jsonb)
  ),
  '{recommendations}',
  COALESCE((SELECT jsonb_agg(item || '{"forBachelor":false,"forMaster":true}'::jsonb) FROM jsonb_array_elements(snapshot -> 'recommendations') AS item), '[]'::jsonb)
)
WHERE status = 'DRAFT'
  AND jsonb_typeof(snapshot) = 'object';--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.sync_config_audience_from_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.questions AS target
  SET for_bachelor = COALESCE((source.item ->> 'forBachelor')::boolean, false),
      for_master = COALESCE((source.item ->> 'forMaster')::boolean, true)
  FROM jsonb_array_elements(COALESCE(NEW.snapshot -> 'questions', '[]'::jsonb)) AS source(item)
  WHERE target.config_version_id = NEW.id
    AND target.stable_id = source.item ->> 'stableId';
  UPDATE public.modules AS target
  SET for_bachelor = COALESCE((source.item ->> 'forBachelor')::boolean, false),
      for_master = COALESCE((source.item ->> 'forMaster')::boolean, true)
  FROM jsonb_array_elements(COALESCE(NEW.snapshot -> 'modules', '[]'::jsonb)) AS source(item)
  WHERE target.config_version_id = NEW.id
    AND target.stable_id = source.item ->> 'stableId';
  UPDATE public.recommendations AS target
  SET for_bachelor = COALESCE((source.item ->> 'forBachelor')::boolean, false),
      for_master = COALESCE((source.item ->> 'forMaster')::boolean, true)
  FROM jsonb_array_elements(COALESCE(NEW.snapshot -> 'recommendations', '[]'::jsonb)) AS source(item)
  WHERE target.config_version_id = NEW.id
    AND target.stable_id = source.item ->> 'stableId';
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER config_versions_sync_audience
AFTER UPDATE OF snapshot ON public.config_versions
FOR EACH ROW EXECUTE FUNCTION public.sync_config_audience_from_snapshot();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.public_start_trajectory_session(
  p_isu text,
  p_education_level public.education_level,
  p_config_version_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_snapshot jsonb;
  v_session_id uuid;
  v_status public.trajectory_session_status;
BEGIN
  IF p_isu !~ '^[0-9]+$' OR p_config_version_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'TRAJECTORY_COMPLETION_INVALID';
  END IF;
  SELECT snapshot INTO v_snapshot
  FROM public.config_versions
  WHERE id = p_config_version_id AND status = 'PUBLISHED';
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_CONFIG_MISMATCH';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_snapshot -> 'questions', '[]'::jsonb)) AS question(item)
    WHERE COALESCE((question.item ->> 'active')::boolean, false)
      AND CASE WHEN p_education_level = 'BACHELOR'
        THEN COALESCE((question.item ->> 'forBachelor')::boolean, false)
        ELSE COALESCE((question.item ->> 'forMaster')::boolean, true)
      END
  ) THEN
    v_status := 'IN_PROGRESS';
  ELSE
    v_status := 'UNAVAILABLE';
  END IF;
  INSERT INTO public.trajectory_sessions (isu, education_level, config_version_id, status)
  VALUES (p_isu, p_education_level, p_config_version_id, v_status)
  RETURNING id INTO v_session_id;
  RETURN jsonb_build_object(
    'sessionId', v_session_id,
    'configVersionId', p_config_version_id,
    'educationLevel', p_education_level,
    'status', v_status
  );
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.public_get_trajectory_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT jsonb_build_object(
      'id', session.id,
      'configVersionId', session.config_version_id,
      'educationLevel', session.education_level,
      'status', session.status
    )
    FROM public.trajectory_sessions AS session
    WHERE session.id = p_session_id
  ), 'null'::jsonb)
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.public_replace_session_answers(
  p_session_id uuid,
  p_question_id text,
  p_answer_option_ids jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.trajectory_sessions%ROWTYPE;
  v_snapshot jsonb;
  v_question jsonb;
  v_answer_count integer;
  v_min integer;
  v_max integer;
BEGIN
  IF p_question_id IS NULL OR jsonb_typeof(p_answer_option_ids) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'TRAJECTORY_ANSWER_INVALID';
  END IF;
  SELECT * INTO v_session FROM public.trajectory_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_NOT_FOUND'; END IF;
  IF v_session.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_NOT_IN_PROGRESS'; END IF;
  SELECT snapshot INTO v_snapshot FROM public.config_versions WHERE id = v_session.config_version_id AND status = 'PUBLISHED';
  SELECT item INTO v_question
  FROM jsonb_array_elements(COALESCE(v_snapshot -> 'questions', '[]'::jsonb)) AS question(item)
  WHERE item ->> 'stableId' = p_question_id
    AND COALESCE((item ->> 'active')::boolean, false)
    AND CASE WHEN v_session.education_level = 'BACHELOR'
      THEN COALESCE((item ->> 'forBachelor')::boolean, false)
      ELSE COALESCE((item ->> 'forMaster')::boolean, true)
    END;
  IF v_question IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_ANSWER_INVALID'; END IF;
  SELECT count(*), count(DISTINCT value) INTO v_answer_count, v_min
  FROM jsonb_array_elements_text(p_answer_option_ids);
  IF v_answer_count <> v_min THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_ANSWER_INVALID'; END IF;
  v_min := COALESCE((v_question ->> 'minSelect')::integer, 0);
  v_max := COALESCE((v_question ->> 'maxSelect')::integer, 0);
  IF v_answer_count < v_min OR v_answer_count > v_max THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_ANSWER_INVALID'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(p_answer_option_ids) AS selected(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_snapshot -> 'answers', '[]'::jsonb)) AS answer(item)
      WHERE answer.item ->> 'stableId' = selected.id
        AND answer.item ->> 'questionStableId' = p_question_id
        AND COALESCE((answer.item ->> 'active')::boolean, false)
    )
  ) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_ANSWER_INVALID'; END IF;
  DELETE FROM public.session_answers WHERE session_id = p_session_id AND question_id = p_question_id;
  INSERT INTO public.session_answers (session_id, question_id, answer_option_id)
  SELECT p_session_id, p_question_id, value FROM jsonb_array_elements_text(p_answer_option_ids);
  UPDATE public.trajectory_sessions SET last_activity_at = clock_timestamp() WHERE id = p_session_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.public_complete_trajectory_session(
  p_session_id uuid,
  p_selected_answer_ids jsonb,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.trajectory_sessions%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_primary_module_id text;
BEGIN
  IF jsonb_typeof(p_selected_answer_ids) <> 'array'
     OR jsonb_typeof(p_payload) <> 'object'
     OR jsonb_typeof(p_payload -> 'scores') <> 'array'
     OR jsonb_typeof(p_payload -> 'contributions') <> 'array'
     OR jsonb_typeof(p_payload -> 'moduleResults') <> 'array'
     OR jsonb_typeof(p_payload -> 'recommendations') <> 'array'
     OR jsonb_typeof(p_payload -> 'resultSnapshot') <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'TRAJECTORY_COMPLETION_INVALID';
  END IF;
  SELECT * INTO v_session FROM public.trajectory_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_NOT_FOUND'; END IF;
  IF v_session.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_NOT_IN_PROGRESS'; END IF;
  IF p_payload #>> '{resultSnapshot,configVersionId}' IS DISTINCT FROM v_session.config_version_id::text THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_CONFIG_MISMATCH';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(p_selected_answer_ids) AS selected(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.session_answers AS saved
      WHERE saved.session_id = p_session_id AND saved.answer_option_id = selected.id
    )
  ) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_COMPLETION_INVALID'; END IF;

  INSERT INTO public.session_module_scores (session_id, module_id, total_score, final_rank, q2_score, q3_score, q1_score, q5_score)
  SELECT p_session_id, item."moduleId", item."totalScore", item."finalRank", item."q2Score", item."q3Score", item."q1Score", item."q5Score"
  FROM jsonb_to_recordset(p_payload -> 'scores') AS item("moduleId" text, "totalScore" integer, "finalRank" integer, "q2Score" integer, "q3Score" integer, "q1Score" integer, "q5Score" integer);
  INSERT INTO public.session_score_contributions (session_id, question_id, answer_option_id, module_id, weight)
  SELECT p_session_id, item."questionId", item."answerOptionId", item."moduleId", item.weight
  FROM jsonb_to_recordset(p_payload -> 'contributions') AS item("questionId" text, "answerOptionId" text, "moduleId" text, weight integer);
  INSERT INTO public.session_module_results (session_id, module_id, kind, position)
  SELECT p_session_id, item."moduleId", item.kind::public.trajectory_module_result_kind, item.position
  FROM jsonb_to_recordset(p_payload -> 'moduleResults') AS item("moduleId" text, kind text, position integer);
  INSERT INTO public.session_recommendations (session_id, recommendation_id, position, source_module_id)
  SELECT p_session_id, item."recommendationId", item.position, item."sourceModuleId"
  FROM jsonb_to_recordset(p_payload -> 'recommendations') AS item("recommendationId" text, position integer, "sourceModuleId" text);
  SELECT item ->> 'moduleId' INTO v_primary_module_id
  FROM jsonb_array_elements(p_payload -> 'moduleResults') AS item
  WHERE item ->> 'kind' = 'PRIMARY' ORDER BY (item ->> 'position')::integer LIMIT 1;
  IF v_primary_module_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_COMPLETION_INVALID'; END IF;
  UPDATE public.trajectory_sessions
  SET status = 'COMPLETED', primary_module_id = v_primary_module_id,
      result_snapshot = p_payload -> 'resultSnapshot', completed_at = v_now,
      last_activity_at = v_now
  WHERE id = p_session_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;--> statement-breakpoint

ALTER TABLE public.trajectory_sessions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.session_answers ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.session_module_scores ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.session_score_contributions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.session_module_results ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.session_recommendations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE public.trajectory_sessions, public.session_answers, public.session_module_scores, public.session_score_contributions, public.session_module_results, public.session_recommendations FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.public_start_trajectory_session(text,public.education_level,uuid) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.public_get_trajectory_session(uuid) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.public_replace_session_answers(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.public_complete_trajectory_session(uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.public_start_trajectory_session(text,public.education_level,uuid) TO service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.public_get_trajectory_session(uuid) TO service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.public_replace_session_answers(uuid,text,jsonb) TO service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.public_complete_trajectory_session(uuid,jsonb,jsonb) TO service_role;
