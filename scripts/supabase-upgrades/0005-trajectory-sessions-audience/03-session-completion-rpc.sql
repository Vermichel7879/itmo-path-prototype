BEGIN;

CREATE OR REPLACE FUNCTION public.public_complete_trajectory_session(p_session_id uuid, p_selected_answer_ids jsonb, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session public.trajectory_sessions%ROWTYPE; v_now timestamptz := clock_timestamp(); v_primary_module_id text;
BEGIN
  IF jsonb_typeof(p_selected_answer_ids) <> 'array' OR jsonb_typeof(p_payload) <> 'object'
    OR jsonb_typeof(p_payload -> 'scores') <> 'array' OR jsonb_typeof(p_payload -> 'contributions') <> 'array'
    OR jsonb_typeof(p_payload -> 'moduleResults') <> 'array' OR jsonb_typeof(p_payload -> 'recommendations') <> 'array'
    OR jsonb_typeof(p_payload -> 'resultSnapshot') <> 'object'
  THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'TRAJECTORY_COMPLETION_INVALID'; END IF;
  SELECT * INTO v_session FROM public.trajectory_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_NOT_FOUND'; END IF;
  IF v_session.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_NOT_IN_PROGRESS'; END IF;
  IF p_payload #>> '{resultSnapshot,configVersionId}' IS DISTINCT FROM v_session.config_version_id::text
    THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_SESSION_CONFIG_MISMATCH'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(p_selected_answer_ids) selected(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.session_answers saved WHERE saved.session_id = p_session_id AND saved.answer_option_id = selected.id)
  ) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_COMPLETION_INVALID'; END IF;

  INSERT INTO public.session_module_scores(session_id,module_id,total_score,final_rank,q2_score,q3_score,q1_score,q5_score)
  SELECT p_session_id,item."moduleId",item."totalScore",item."finalRank",item."q2Score",item."q3Score",item."q1Score",item."q5Score"
  FROM jsonb_to_recordset(p_payload -> 'scores') item("moduleId" text,"totalScore" integer,"finalRank" integer,"q2Score" integer,"q3Score" integer,"q1Score" integer,"q5Score" integer);
  INSERT INTO public.session_score_contributions(session_id,question_id,answer_option_id,module_id,weight)
  SELECT p_session_id,item."questionId",item."answerOptionId",item."moduleId",item.weight
  FROM jsonb_to_recordset(p_payload -> 'contributions') item("questionId" text,"answerOptionId" text,"moduleId" text,weight integer);
  INSERT INTO public.session_module_results(session_id,module_id,kind,position)
  SELECT p_session_id,item."moduleId",item.kind::public.trajectory_module_result_kind,item.position
  FROM jsonb_to_recordset(p_payload -> 'moduleResults') item("moduleId" text,kind text,position integer);
  INSERT INTO public.session_recommendations(session_id,recommendation_id,position,source_module_id)
  SELECT p_session_id,item."recommendationId",item.position,item."sourceModuleId"
  FROM jsonb_to_recordset(p_payload -> 'recommendations') item("recommendationId" text,position integer,"sourceModuleId" text);
  SELECT item ->> 'moduleId' INTO v_primary_module_id FROM jsonb_array_elements(p_payload -> 'moduleResults') item
  WHERE item ->> 'kind' = 'PRIMARY' ORDER BY (item ->> 'position')::integer LIMIT 1;
  IF v_primary_module_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRAJECTORY_COMPLETION_INVALID'; END IF;
  UPDATE public.trajectory_sessions SET status='COMPLETED',primary_module_id=v_primary_module_id,result_snapshot=p_payload -> 'resultSnapshot',completed_at=v_now,last_activity_at=v_now
  WHERE id=p_session_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMIT;

SELECT (to_regprocedure('public.public_complete_trajectory_session(uuid,jsonb,jsonb)') IS NOT NULL) AS completion_rpc_exists;
