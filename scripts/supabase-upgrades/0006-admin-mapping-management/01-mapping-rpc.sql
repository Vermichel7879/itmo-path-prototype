BEGIN;

CREATE OR REPLACE FUNCTION public.admin_mutate_mapping(
  p_actor_user_id uuid,
  p_expected_updated_at timestamptz,
  p_expected_snapshot_hash text,
  p_operation text,
  p_answer_stable_id text,
  p_module_stable_id text,
  p_weight integer,
  p_next_snapshot jsonb,
  p_audit jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_role public.admin_role;
  v_draft_id uuid;
  v_updated_at timestamptz;
  v_snapshot jsonb;
  v_snapshot_hash text;
  v_answer_id uuid;
  v_module_id uuid;
  v_question_for_bachelor boolean;
  v_question_for_master boolean;
  v_module_for_bachelor boolean;
  v_module_for_master boolean;
  v_rows integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_actor_user_id IS NULL
     OR p_expected_updated_at IS NULL
     OR p_expected_snapshot_hash !~ '^[a-f0-9]{64}$'
     OR p_operation NOT IN ('CREATE', 'UPDATE', 'DELETE')
     OR length(trim(p_answer_stable_id)) = 0
     OR length(trim(p_module_stable_id)) = 0
     OR jsonb_typeof(p_next_snapshot) <> 'object'
     OR jsonb_typeof(p_audit) <> 'object'
     OR (p_operation <> 'DELETE' AND (p_weight IS NULL OR p_weight < -10 OR p_weight > 10))
     OR (p_operation = 'DELETE' AND p_weight IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;

  SELECT role
  INTO v_actor_role
  FROM public.admin_users
  WHERE id = p_actor_user_id AND active = true;
  IF v_actor_role IS DISTINCT FROM 'ADMIN'::public.admin_role THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_ACTOR_INVALID';
  END IF;

  SELECT id, updated_at, snapshot
  INTO v_draft_id, v_updated_at, v_snapshot
  FROM public.config_versions
  WHERE status = 'DRAFT'
  FOR UPDATE;
  IF v_draft_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DRAFT_CONFIG_MISSING';
  END IF;

  v_snapshot_hash := encode(
    extensions.digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_updated_at <> p_expected_updated_at
     OR v_snapshot_hash <> p_expected_snapshot_hash THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DRAFT_STALE_REVISION';
  END IF;

  SELECT answer.id, question.for_bachelor, question.for_master
  INTO v_answer_id, v_question_for_bachelor, v_question_for_master
  FROM public.answers AS answer
  JOIN public.questions AS question
    ON question.id = answer.question_id
   AND question.config_version_id = answer.config_version_id
  WHERE answer.config_version_id = v_draft_id
    AND answer.stable_id = p_answer_stable_id;
  IF v_answer_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ANSWER_NOT_FOUND';
  END IF;

  SELECT id, for_bachelor, for_master
  INTO v_module_id, v_module_for_bachelor, v_module_for_master
  FROM public.modules
  WHERE config_version_id = v_draft_id
    AND stable_id = p_module_stable_id;
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MODULE_NOT_FOUND';
  END IF;

  IF p_operation <> 'DELETE'
     AND NOT (
       (v_question_for_bachelor AND v_module_for_bachelor)
       OR (v_question_for_master AND v_module_for_master)
     ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MAPPING_AUDIENCE_INCOMPATIBLE';
  END IF;

  IF p_operation = 'CREATE' THEN
    IF EXISTS (
      SELECT 1
      FROM public.answer_module_weights
      WHERE config_version_id = v_draft_id
        AND answer_id = v_answer_id
        AND module_id = v_module_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MAPPING_ALREADY_EXISTS';
    END IF;
    INSERT INTO public.answer_module_weights (
      config_version_id, answer_id, module_id, weight
    ) VALUES (
      v_draft_id, v_answer_id, v_module_id, p_weight
    );
  ELSIF p_operation = 'UPDATE' THEN
    UPDATE public.answer_module_weights
    SET weight = p_weight
    WHERE config_version_id = v_draft_id
      AND answer_id = v_answer_id
      AND module_id = v_module_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MAPPING_NOT_FOUND';
    END IF;
  ELSE
    DELETE FROM public.answer_module_weights
    WHERE config_version_id = v_draft_id
      AND answer_id = v_answer_id
      AND module_id = v_module_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MAPPING_NOT_FOUND';
    END IF;
  END IF;

  UPDATE public.config_versions
  SET snapshot = p_next_snapshot,
      updated_at = v_now
  WHERE id = v_draft_id;

  INSERT INTO public.audit_log (
    actor_admin_user_id,
    config_version_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_actor_user_id,
    v_draft_id,
    'DRAFT_MAPPING_' || p_operation || 'D',
    'WEIGHT',
    p_answer_stable_id || ':' || p_module_stable_id,
    p_audit
  );

  RETURN jsonb_build_object('id', v_draft_id, 'updatedAt', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb) TO service_role;

COMMIT;

SELECT
  to_regprocedure('public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)') IS NOT NULL AS mapping_rpc_exists,
  has_function_privilege('service_role', 'public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE') AS service_role_execute,
  has_function_privilege('anon', 'public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', 'public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb)', 'EXECUTE') AS authenticated_execute;
