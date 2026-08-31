CREATE OR REPLACE FUNCTION public.public_get_pinned_questionnaire(
  p_config_version_id uuid,
  p_education_level public.education_level
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH pinned AS (
    SELECT version.id, version.snapshot
    FROM public.config_versions AS version
    WHERE version.id = p_config_version_id
      AND version.status = 'PUBLISHED'
    LIMIT 1
  ),
  branch AS (
    SELECT rule.item -> 'params' AS params
    FROM pinned
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(pinned.snapshot -> 'engineRules', '[]'::jsonb)
    ) WITH ORDINALITY AS rule(item, ordinal)
    WHERE rule.item ->> 'ruleKind' = 'CONDITIONAL_BRANCH'
      AND COALESCE((rule.item ->> 'active')::boolean, false)
    ORDER BY COALESCE((rule.item ->> 'sortOrder')::integer, rule.ordinal::integer)
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'configVersionId', pinned.id,
    'educationLevel', p_education_level,
    'branchQuestionIds', branch.params -> 'questionIds',
    'signalTag', branch.params #>> '{condition,tag}',
    'questions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', question.item ->> 'stableId',
          'block', question.item ->> 'block',
          'title', question.item ->> 'text',
          'selectionType', question.item ->> 'selectionType',
          'minSelect', (question.item ->> 'minSelect')::integer,
          'maxSelect', (question.item ->> 'maxSelect')::integer,
          'required', (question.item ->> 'required')::boolean,
          'answers', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', answer.item ->> 'stableId',
                'text', answer.item ->> 'text',
                'tags', COALESCE(answer.item -> 'tags', '[]'::jsonb)
              ) ORDER BY (answer.item ->> 'sortOrder')::integer, answer.ordinal
            )
            FROM jsonb_array_elements(
              COALESCE(pinned.snapshot -> 'answers', '[]'::jsonb)
            ) WITH ORDINALITY AS answer(item, ordinal)
            WHERE answer.item ->> 'questionStableId' = question.item ->> 'stableId'
              AND COALESCE((answer.item ->> 'active')::boolean, false)
          ), '[]'::jsonb)
        ) ORDER BY (question.item ->> 'sortOrder')::integer, question.ordinal
      )
      FROM jsonb_array_elements(
        COALESCE(pinned.snapshot -> 'questions', '[]'::jsonb)
      ) WITH ORDINALITY AS question(item, ordinal)
      WHERE COALESCE((question.item ->> 'active')::boolean, false)
        AND CASE
          WHEN p_education_level = 'BACHELOR' THEN
            COALESCE((question.item ->> 'forBachelor')::boolean, false)
          ELSE
            COALESCE((question.item ->> 'forMaster')::boolean, true)
        END
    ), '[]'::jsonb)
  )
  FROM pinned
  CROSS JOIN branch
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.public_get_pinned_questionnaire(uuid, public.education_level)
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.public_get_pinned_questionnaire(uuid, public.education_level)
TO service_role;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.public_get_pinned_engine_config(
  p_config_version_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'configVersionId', version.id,
    'config', jsonb_build_object(
      'questions', COALESCE(version.snapshot -> 'questions', '[]'::jsonb),
      'answers', COALESCE(version.snapshot -> 'answers', '[]'::jsonb),
      'mappings', COALESCE(version.snapshot -> 'mappings', '[]'::jsonb),
      'modules', COALESCE(version.snapshot -> 'modules', '[]'::jsonb),
      'modifiers', COALESCE(version.snapshot -> 'modifiers', '[]'::jsonb),
      'recommendations', COALESCE(version.snapshot -> 'recommendations', '[]'::jsonb),
      'moduleRecommendations', COALESCE(version.snapshot -> 'moduleRecommendations', '[]'::jsonb),
      'opportunities', COALESCE(version.snapshot -> 'opportunities', '[]'::jsonb),
      'entrepreneurStages', COALESCE(version.snapshot -> 'entrepreneurStages', '[]'::jsonb),
      'entrepreneurChallenges', COALESCE(version.snapshot -> 'entrepreneurChallenges', '[]'::jsonb),
      'engineRules', COALESCE(version.snapshot -> 'engineRules', '[]'::jsonb)
    )
  )
  FROM public.config_versions AS version
  WHERE version.id = p_config_version_id
    AND version.status = 'PUBLISHED'
  LIMIT 1
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.public_get_pinned_engine_config(uuid)
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.public_get_pinned_engine_config(uuid)
TO service_role;
