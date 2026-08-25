-- Initial immutable publish for PHASE 3. Run once in Supabase SQL Editor.
-- This script never updates or deletes the DRAFT.
BEGIN;

LOCK TABLE config_versions IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  draft_id uuid;
  draft_snapshot jsonb;
BEGIN
  IF (SELECT count(*) FROM config_versions WHERE status = 'DRAFT') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one DRAFT config';
  END IF;
  IF (SELECT count(*) FROM config_versions WHERE status = 'PUBLISHED') <> 0 THEN
    RAISE EXCEPTION 'Initial PUBLISHED config already exists';
  END IF;

  SELECT id, snapshot
  INTO STRICT draft_id, draft_snapshot
  FROM config_versions
  WHERE status = 'DRAFT';

  IF draft_id <> 'a8ad8398-48dc-41d7-9793-5e21248be966'::uuid THEN
    RAISE EXCEPTION 'Unexpected DRAFT config ID';
  END IF;
  IF (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 3 THEN
    RAISE EXCEPTION 'Expected three Drizzle migration records';
  END IF;

  IF (SELECT count(*) FROM questions WHERE config_version_id = draft_id) <> 10
     OR (SELECT count(*) FROM answers WHERE config_version_id = draft_id) <> 75
     OR (SELECT count(*) FROM answer_module_weights WHERE config_version_id = draft_id) <> 52
     OR (SELECT count(*) FROM modules WHERE config_version_id = draft_id) <> 11
     OR (SELECT count(*) FROM recommendations WHERE config_version_id = draft_id) <> 22
     OR (SELECT count(*) FROM module_recommendations WHERE config_version_id = draft_id) <> 51
     OR (SELECT count(*) FROM modifiers WHERE config_version_id = draft_id) <> 12
     OR (SELECT count(*) FROM entrepreneur_stages WHERE config_version_id = draft_id) <> 5
     OR (SELECT count(*) FROM entrepreneur_challenges WHERE config_version_id = draft_id) <> 8
     OR (SELECT count(*) FROM engine_rules WHERE config_version_id = draft_id) <> 17
     OR (SELECT count(*) FROM documentation_examples WHERE config_version_id = draft_id) <> 7 THEN
    RAISE EXCEPTION 'DRAFT entity counts do not match validated PHASE 2.5 state';
  END IF;

  IF (SELECT count(DISTINCT stable_id) FROM engine_rules WHERE config_version_id = draft_id) <> 17
     OR (SELECT array_agg(stable_id::text ORDER BY sort_order)
         FROM engine_rules WHERE config_version_id = draft_id) <> ARRAY[
           'R01','R02','R03','R04','R05','R06','R07','R08','R09',
           'R10','R11','R12','R13','R14','R15','R16','R17'
         ]
     OR EXISTS (
       SELECT 1 FROM engine_rules
       WHERE config_version_id = draft_id
         AND (params IS NULL OR jsonb_typeof(params) <> 'object'
           OR length(trim(source_title)) = 0 OR length(trim(source_content)) = 0)
     ) THEN
    RAISE EXCEPTION 'Typed R01-R17 validation failed';
  END IF;

  IF (SELECT count(*) FROM modifiers
      WHERE config_version_id = draft_id
        AND operation_kind IS NOT NULL
        AND operation_params IS NOT NULL) <> 12
     OR EXISTS (
       SELECT 1 FROM modifiers
       WHERE config_version_id = draft_id
         AND (jsonb_typeof(effect) <> 'object'
           OR length(trim(effect ->> 'description')) = 0)
     ) THEN
    RAISE EXCEPTION 'Typed modifier validation failed';
  END IF;

  IF (SELECT count(DISTINCT sort_order) FROM modules WHERE config_version_id = draft_id) <> 11
     OR EXISTS (
       SELECT 1 FROM modules
       WHERE config_version_id = draft_id
         AND sort_order <> substring(stable_id FROM 2)::int
     ) THEN
    RAISE EXCEPTION 'Module sort order validation failed';
  END IF;

  IF jsonb_typeof(draft_snapshot) <> 'object'
     OR jsonb_array_length(draft_snapshot -> 'questions') <> 10
     OR jsonb_array_length(draft_snapshot -> 'answers') <> 75
     OR jsonb_array_length(draft_snapshot -> 'mappings') <> 52
     OR jsonb_array_length(draft_snapshot -> 'modules') <> 11
     OR jsonb_array_length(draft_snapshot -> 'modifiers') <> 12
     OR jsonb_array_length(draft_snapshot -> 'recommendations') <> 22
     OR jsonb_array_length(draft_snapshot -> 'moduleRecommendations') <> 51
     OR jsonb_array_length(draft_snapshot -> 'entrepreneurStages') <> 5
     OR jsonb_array_length(draft_snapshot -> 'entrepreneurChallenges') <> 8
     OR jsonb_array_length(draft_snapshot -> 'engineRules') <> 17
     OR jsonb_array_length(draft_snapshot -> 'documentationExamples') <> 7
     OR draft_snapshot ? 'rules'
     OR draft_snapshot ? 'examples' THEN
    RAISE EXCEPTION 'Typed DRAFT snapshot validation failed';
  END IF;
END;
$$;

INSERT INTO config_versions (
  version_number,
  status,
  label,
  source_file_name,
  source_sha256,
  snapshot,
  published_at,
  created_at,
  updated_at
)
SELECT
  (SELECT coalesce(max(version_number), 0) + 1 FROM config_versions),
  'PUBLISHED',
  'Initial published career configuration',
  source_file_name,
  source_sha256,
  snapshot,
  now(),
  now(),
  now()
FROM config_versions
WHERE status = 'DRAFT';

DO $$
BEGIN
  IF (SELECT count(*) FROM config_versions WHERE status = 'DRAFT') <> 1
     OR (SELECT count(*) FROM config_versions WHERE status = 'PUBLISHED') <> 1 THEN
    RAISE EXCEPTION 'Initial publish postcondition failed';
  END IF;
END;
$$;

COMMIT;

SELECT
  (SELECT id FROM config_versions WHERE status = 'DRAFT') AS draft_config_id,
  (SELECT id FROM config_versions WHERE status = 'PUBLISHED') AS published_config_id,
  (SELECT count(*) FROM config_versions WHERE status = 'DRAFT') AS draft_configs,
  (SELECT count(*) FROM config_versions WHERE status = 'PUBLISHED') AS published_configs,
  (SELECT jsonb_array_length(snapshot -> 'engineRules')
   FROM config_versions WHERE status = 'PUBLISHED') AS published_engine_rules,
  (SELECT jsonb_array_length(snapshot -> 'modifiers')
   FROM config_versions WHERE status = 'PUBLISHED') AS published_modifiers;
