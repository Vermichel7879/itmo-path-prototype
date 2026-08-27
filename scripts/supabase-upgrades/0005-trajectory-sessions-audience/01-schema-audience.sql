BEGIN;

CREATE TYPE public.education_level AS ENUM ('BACHELOR', 'MASTER');
CREATE TYPE public.trajectory_module_result_kind AS ENUM ('PRIMARY', 'SUPPORT');
CREATE TYPE public.trajectory_session_status AS ENUM ('IN_PROGRESS', 'COMPLETED', 'UNAVAILABLE');

ALTER TABLE public.questions ADD COLUMN for_bachelor boolean DEFAULT false NOT NULL;
ALTER TABLE public.questions ADD COLUMN for_master boolean DEFAULT true NOT NULL;
ALTER TABLE public.modules ADD COLUMN for_bachelor boolean DEFAULT false NOT NULL;
ALTER TABLE public.modules ADD COLUMN for_master boolean DEFAULT true NOT NULL;
ALTER TABLE public.recommendations ADD COLUMN for_bachelor boolean DEFAULT false NOT NULL;
ALTER TABLE public.recommendations ADD COLUMN for_master boolean DEFAULT true NOT NULL;

CREATE TABLE public.trajectory_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  isu text NOT NULL CHECK (isu ~ '^[0-9]+$'),
  education_level public.education_level NOT NULL,
  config_version_id uuid NOT NULL REFERENCES public.config_versions(id) ON DELETE RESTRICT,
  status public.trajectory_session_status NOT NULL,
  primary_module_id varchar(40),
  result_snapshot jsonb,
  started_at timestamptz DEFAULT now() NOT NULL,
  last_activity_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  CONSTRAINT trajectory_sessions_completion_consistent CHECK (
    (status = 'COMPLETED' AND completed_at IS NOT NULL AND result_snapshot IS NOT NULL)
    OR (status <> 'COMPLETED' AND completed_at IS NULL)
  )
);
CREATE INDEX trajectory_sessions_isu_idx ON public.trajectory_sessions(isu);
CREATE INDEX trajectory_sessions_config_idx ON public.trajectory_sessions(config_version_id);
CREATE INDEX trajectory_sessions_status_idx ON public.trajectory_sessions(status);

CREATE TABLE public.session_answers (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.trajectory_sessions(id) ON DELETE CASCADE,
  question_id varchar(40) NOT NULL,
  answer_option_id varchar(60) NOT NULL,
  selected_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX session_answers_selection_unique ON public.session_answers(session_id, question_id, answer_option_id);
CREATE INDEX session_answers_session_question_idx ON public.session_answers(session_id, question_id);

CREATE TABLE public.session_module_scores (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.trajectory_sessions(id) ON DELETE CASCADE,
  module_id varchar(40) NOT NULL,
  total_score integer NOT NULL,
  final_rank integer NOT NULL,
  q2_score integer DEFAULT 0 NOT NULL,
  q3_score integer DEFAULT 0 NOT NULL,
  q1_score integer DEFAULT 0 NOT NULL,
  q5_score integer DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX session_module_scores_unique ON public.session_module_scores(session_id, module_id);

CREATE TABLE public.session_score_contributions (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.trajectory_sessions(id) ON DELETE CASCADE,
  question_id varchar(40) NOT NULL,
  answer_option_id varchar(60) NOT NULL,
  module_id varchar(40) NOT NULL,
  weight integer NOT NULL
);
CREATE INDEX session_score_contributions_session_idx ON public.session_score_contributions(session_id);

CREATE TABLE public.session_module_results (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.trajectory_sessions(id) ON DELETE CASCADE,
  module_id varchar(40) NOT NULL,
  kind public.trajectory_module_result_kind NOT NULL,
  position integer NOT NULL
);
CREATE UNIQUE INDEX session_module_results_unique ON public.session_module_results(session_id, kind, position);

CREATE TABLE public.session_recommendations (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.trajectory_sessions(id) ON DELETE CASCADE,
  recommendation_id varchar(100) NOT NULL,
  position integer NOT NULL,
  source_module_id varchar(40)
);
CREATE UNIQUE INDEX session_recommendations_unique ON public.session_recommendations(session_id, position);

UPDATE public.config_versions
SET snapshot = jsonb_set(
  jsonb_set(
    jsonb_set(snapshot, '{questions}', COALESCE((SELECT jsonb_agg(item || '{"forBachelor":false,"forMaster":true}'::jsonb) FROM jsonb_array_elements(snapshot -> 'questions') item), '[]'::jsonb)),
    '{modules}', COALESCE((SELECT jsonb_agg(item || '{"forBachelor":false,"forMaster":true}'::jsonb) FROM jsonb_array_elements(snapshot -> 'modules') item), '[]'::jsonb)
  ),
  '{recommendations}', COALESCE((SELECT jsonb_agg(item || '{"forBachelor":false,"forMaster":true}'::jsonb) FROM jsonb_array_elements(snapshot -> 'recommendations') item), '[]'::jsonb)
)
WHERE status = 'DRAFT'
  AND jsonb_typeof(snapshot) = 'object';

CREATE OR REPLACE FUNCTION public.sync_config_audience_from_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.questions target SET
    for_bachelor = COALESCE((source.item ->> 'forBachelor')::boolean, false),
    for_master = COALESCE((source.item ->> 'forMaster')::boolean, true)
  FROM jsonb_array_elements(COALESCE(NEW.snapshot -> 'questions', '[]'::jsonb)) source(item)
  WHERE target.config_version_id = NEW.id AND target.stable_id = source.item ->> 'stableId';
  UPDATE public.modules target SET
    for_bachelor = COALESCE((source.item ->> 'forBachelor')::boolean, false),
    for_master = COALESCE((source.item ->> 'forMaster')::boolean, true)
  FROM jsonb_array_elements(COALESCE(NEW.snapshot -> 'modules', '[]'::jsonb)) source(item)
  WHERE target.config_version_id = NEW.id AND target.stable_id = source.item ->> 'stableId';
  UPDATE public.recommendations target SET
    for_bachelor = COALESCE((source.item ->> 'forBachelor')::boolean, false),
    for_master = COALESCE((source.item ->> 'forMaster')::boolean, true)
  FROM jsonb_array_elements(COALESCE(NEW.snapshot -> 'recommendations', '[]'::jsonb)) source(item)
  WHERE target.config_version_id = NEW.id AND target.stable_id = source.item ->> 'stableId';
  RETURN NEW;
END;
$$;
CREATE TRIGGER config_versions_sync_audience AFTER UPDATE OF snapshot ON public.config_versions
FOR EACH ROW EXECUTE FUNCTION public.sync_config_audience_from_snapshot();

COMMIT;

SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('trajectory_sessions','session_answers','session_module_scores','session_score_contributions','session_module_results','session_recommendations')) AS session_tables,
  (SELECT count(*) FROM public.config_versions config
   WHERE config.status = 'PUBLISHED'
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(COALESCE(config.snapshot -> 'questions', '[]'::jsonb)) question(item)
       WHERE COALESCE((question.item ->> 'active')::boolean, false)
         AND (
           NOT COALESCE((question.item ->> 'forMaster')::boolean, true)
           OR COALESCE((question.item ->> 'forBachelor')::boolean, false)
         )
     )) AS published_effective_master_snapshots;
