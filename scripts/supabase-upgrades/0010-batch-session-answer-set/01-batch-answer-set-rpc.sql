BEGIN;

CREATE OR REPLACE FUNCTION public.public_replace_session_answer_set(
  p_session_id uuid,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.trajectory_sessions%ROWTYPE;
  v_snapshot jsonb;
  v_entry jsonb;
  v_question jsonb;
  v_question_id text;
  v_answer_option_ids jsonb;
  v_answer_count integer;
  v_distinct_answer_count integer;
  v_min integer;
  v_max integer;
BEGIN
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'TRAJECTORY_ANSWER_SET_INVALID';
  END IF;

  SELECT * INTO v_session
  FROM public.trajectory_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_NOT_FOUND';
  END IF;
  IF v_session.status <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_NOT_IN_PROGRESS';
  END IF;

  SELECT snapshot INTO v_snapshot
  FROM public.config_versions
  WHERE id = v_session.config_version_id
    AND status = 'PUBLISHED';

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_CONFIG_UNAVAILABLE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_answers) AS answer_set(item)
    WHERE jsonb_typeof(answer_set.item) <> 'object'
       OR NULLIF(btrim(answer_set.item ->> 'questionId'), '') IS NULL
       OR jsonb_typeof(answer_set.item -> 'answerOptionIds') <> 'array'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_answers) AS answer_set(item)
    GROUP BY answer_set.item ->> 'questionId'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'TRAJECTORY_ANSWER_SET_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_answers) AS answer_set(item)
    CROSS JOIN LATERAL jsonb_array_elements(answer_set.item -> 'answerOptionIds') AS selected(item)
    WHERE jsonb_typeof(selected.item) <> 'string'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'TRAJECTORY_ANSWER_SET_INVALID';
  END IF;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(p_answers)
  LOOP
    v_question_id := v_entry ->> 'questionId';
    v_answer_option_ids := v_entry -> 'answerOptionIds';

    SELECT item INTO v_question
    FROM jsonb_array_elements(COALESCE(v_snapshot -> 'questions', '[]'::jsonb)) AS question(item)
    WHERE item ->> 'stableId' = v_question_id
      AND COALESCE((item ->> 'active')::boolean, false)
      AND CASE WHEN v_session.education_level = 'BACHELOR'
        THEN COALESCE((item ->> 'forBachelor')::boolean, false)
        ELSE COALESCE((item ->> 'forMaster')::boolean, true)
      END;

    IF v_question IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_ANSWER_INVALID';
    END IF;

    SELECT count(*), count(DISTINCT value)
    INTO v_answer_count, v_distinct_answer_count
    FROM jsonb_array_elements_text(v_answer_option_ids);

    IF v_answer_count <> v_distinct_answer_count THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_ANSWER_INVALID';
    END IF;

    v_min := COALESCE((v_question ->> 'minSelect')::integer, 0);
    v_max := COALESCE((v_question ->> 'maxSelect')::integer, 0);
    IF v_answer_count < v_min OR v_answer_count > v_max THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_ANSWER_INVALID';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_answer_option_ids) AS selected(id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(v_snapshot -> 'answers', '[]'::jsonb)) AS answer(item)
        WHERE answer.item ->> 'stableId' = selected.id
          AND answer.item ->> 'questionStableId' = v_question_id
          AND COALESCE((answer.item ->> 'active')::boolean, false)
      )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_ANSWER_INVALID';
    END IF;
  END LOOP;

  DELETE FROM public.session_answers
  WHERE session_id = p_session_id;

  INSERT INTO public.session_answers (session_id, question_id, answer_option_id)
  SELECT
    p_session_id,
    answer_set.item ->> 'questionId',
    selected.id
  FROM jsonb_array_elements(p_answers) AS answer_set(item)
  CROSS JOIN LATERAL jsonb_array_elements_text(answer_set.item -> 'answerOptionIds') AS selected(id);

  UPDATE public.trajectory_sessions
  SET last_activity_at = clock_timestamp()
  WHERE id = p_session_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.public_replace_session_answer_set(uuid,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.public_replace_session_answer_set(uuid,jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_replace_session_answer_set(uuid,jsonb) TO service_role;

COMMIT;

SELECT
  to_regprocedure('public.public_replace_session_answer_set(uuid,jsonb)') IS NOT NULL
    AS batch_answer_rpc_exists,
  has_function_privilege('service_role', 'public.public_replace_session_answer_set(uuid,jsonb)', 'EXECUTE')
    AS service_role_execute,
  NOT has_function_privilege('anon', 'public.public_replace_session_answer_set(uuid,jsonb)', 'EXECUTE')
    AS anon_execute_denied,
  NOT has_function_privilege('authenticated', 'public.public_replace_session_answer_set(uuid,jsonb)', 'EXECUTE')
    AS authenticated_execute_denied;
