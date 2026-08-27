BEGIN;

CREATE OR REPLACE FUNCTION public.public_start_trajectory_session(p_isu text, p_education_level public.education_level, p_config_version_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_snapshot jsonb; v_session_id uuid; v_status public.trajectory_session_status;
BEGIN
  IF p_isu !~ '^[0-9]+$' OR p_config_version_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'TRAJECTORY_COMPLETION_INVALID'; END IF;
  SELECT snapshot INTO v_snapshot FROM public.config_versions WHERE id = p_config_version_id AND status = 'PUBLISHED';
  IF v_snapshot IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_CONFIG_MISMATCH'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_snapshot -> 'questions', '[]'::jsonb)) question(item)
    WHERE COALESCE((question.item ->> 'active')::boolean, false)
      AND CASE WHEN p_education_level = 'BACHELOR' THEN COALESCE((question.item ->> 'forBachelor')::boolean, false) ELSE COALESCE((question.item ->> 'forMaster')::boolean, true) END
  ) THEN v_status := 'IN_PROGRESS'; ELSE v_status := 'UNAVAILABLE'; END IF;
  INSERT INTO public.trajectory_sessions(isu, education_level, config_version_id, status)
  VALUES (p_isu, p_education_level, p_config_version_id, v_status) RETURNING id INTO v_session_id;
  RETURN jsonb_build_object('sessionId', v_session_id, 'configVersionId', p_config_version_id, 'educationLevel', p_education_level, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.public_get_trajectory_session(p_session_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT COALESCE((SELECT jsonb_build_object('id', session.id, 'configVersionId', session.config_version_id, 'educationLevel', session.education_level, 'status', session.status)
    FROM public.trajectory_sessions session WHERE session.id = p_session_id), 'null'::jsonb)
$$;

CREATE OR REPLACE FUNCTION public.public_replace_session_answers(p_session_id uuid, p_question_id text, p_answer_option_ids jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_session public.trajectory_sessions%ROWTYPE; v_snapshot jsonb; v_question jsonb;
  v_answer_count integer; v_distinct_count integer; v_min integer; v_max integer;
BEGIN
  IF p_question_id IS NULL OR jsonb_typeof(p_answer_option_ids) <> 'array' THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'TRAJECTORY_ANSWER_INVALID'; END IF;
  SELECT * INTO v_session FROM public.trajectory_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_NOT_FOUND'; END IF;
  IF v_session.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_NOT_IN_PROGRESS'; END IF;
  SELECT snapshot INTO v_snapshot FROM public.config_versions WHERE id = v_session.config_version_id AND status = 'PUBLISHED';
  SELECT item INTO v_question FROM jsonb_array_elements(COALESCE(v_snapshot -> 'questions', '[]'::jsonb)) question(item)
  WHERE item ->> 'stableId' = p_question_id AND COALESCE((item ->> 'active')::boolean, false)
    AND CASE WHEN v_session.education_level = 'BACHELOR' THEN COALESCE((item ->> 'forBachelor')::boolean, false) ELSE COALESCE((item ->> 'forMaster')::boolean, true) END;
  IF v_question IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_ANSWER_INVALID'; END IF;
  SELECT count(*), count(DISTINCT value) INTO v_answer_count, v_distinct_count FROM jsonb_array_elements_text(p_answer_option_ids);
  v_min := COALESCE((v_question ->> 'minSelect')::integer, 0); v_max := COALESCE((v_question ->> 'maxSelect')::integer, 0);
  IF v_answer_count <> v_distinct_count OR v_answer_count < v_min OR v_answer_count > v_max THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_ANSWER_INVALID'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(p_answer_option_ids) selected(id)
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_snapshot -> 'answers', '[]'::jsonb)) answer(item)
      WHERE answer.item ->> 'stableId' = selected.id AND answer.item ->> 'questionStableId' = p_question_id AND COALESCE((answer.item ->> 'active')::boolean, false))
  ) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_ANSWER_INVALID'; END IF;
  DELETE FROM public.session_answers WHERE session_id = p_session_id AND question_id = p_question_id;
  INSERT INTO public.session_answers(session_id, question_id, answer_option_id)
  SELECT p_session_id, p_question_id, value FROM jsonb_array_elements_text(p_answer_option_ids);
  UPDATE public.trajectory_sessions SET last_activity_at = clock_timestamp() WHERE id = p_session_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMIT;

SELECT count(*) AS progress_rpc_functions
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('public_start_trajectory_session','public_get_trajectory_session','public_replace_session_answers');
