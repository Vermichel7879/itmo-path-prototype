BEGIN;

CREATE OR REPLACE FUNCTION public.admin_get_draft()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', config.id,
    'updatedAt', config.updated_at,
    'snapshotHash', encode(
      extensions.digest(convert_to(config.snapshot::text, 'UTF8'), 'sha256'),
      'hex'
    ),
    'snapshot', config.snapshot
  )
  INTO v_result
  FROM public.config_versions AS config
  WHERE config.status = 'DRAFT'
  LIMIT 1;
  IF v_result IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DRAFT_CONFIG_MISSING';
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mutate_draft(
  p_actor_user_id uuid,
  p_expected_updated_at timestamptz,
  p_expected_snapshot_hash text,
  p_mutation jsonb,
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
  v_entity_type text;
  v_stable_id text;
  v_values jsonb;
  v_question_id uuid;
  v_answer_id uuid;
  v_module_id uuid;
  v_rows integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_actor_user_id IS NULL
     OR p_expected_updated_at IS NULL
     OR p_expected_snapshot_hash !~ '^[a-f0-9]{64}$'
     OR jsonb_typeof(p_mutation) <> 'object'
     OR jsonb_typeof(p_next_snapshot) <> 'object'
     OR jsonb_typeof(p_audit) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;

  SELECT role
  INTO v_actor_role
  FROM public.admin_users
  WHERE id = p_actor_user_id AND active = true;
  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_ACTOR_INVALID';
  END IF;

  v_entity_type := p_mutation ->> 'entityType';
  v_stable_id := p_mutation ->> 'stableId';
  v_values := p_mutation -> 'values';
  IF v_entity_type IS NULL OR length(trim(v_stable_id)) = 0
     OR jsonb_typeof(v_values) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;
  IF v_actor_role = 'EDITOR'
     AND (
       v_entity_type IN ('WEIGHT', 'RULE', 'MODIFIER')
       OR (v_entity_type = 'MODULE' AND v_values ? 'sortOrder')
     ) THEN
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

  IF v_entity_type = 'QUESTION_CREATE' THEN
    IF v_stable_id !~ '^Q[0-9]+$'
       OR (v_values #>> '{firstAnswer,stableId}')
          NOT LIKE v_stable_id || '_A%' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
    END IF;
    INSERT INTO public.questions (
      config_version_id, stable_id, block, text, selection_type,
      min_select, max_select, required, sort_order, show_condition, active
    ) VALUES (
      v_draft_id,
      v_stable_id,
      v_values ->> 'block',
      v_values ->> 'text',
      (v_values ->> 'selectionType')::public.question_selection_type,
      (v_values ->> 'minSelect')::integer,
      (v_values ->> 'maxSelect')::integer,
      (v_values ->> 'required')::boolean,
      (v_values ->> 'sortOrder')::integer,
      v_values -> 'showCondition',
      true
    ) RETURNING id INTO v_question_id;
    INSERT INTO public.answers (
      config_version_id, question_id, stable_id, text,
      sort_order, tags, keys, active
    ) VALUES (
      v_draft_id,
      v_question_id,
      v_values #>> '{firstAnswer,stableId}',
      v_values #>> '{firstAnswer,text}',
      1,
      '[]'::jsonb,
      '[]'::jsonb,
      true
    );
  ELSIF v_entity_type = 'ANSWER_CREATE' THEN
    IF v_stable_id NOT LIKE (v_values ->> 'questionStableId') || '_A%' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
    END IF;
    SELECT id INTO v_question_id
    FROM public.questions
    WHERE config_version_id = v_draft_id
      AND stable_id = v_values ->> 'questionStableId';
    IF v_question_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUESTION_NOT_FOUND';
    END IF;
    INSERT INTO public.answers (
      config_version_id, question_id, stable_id, text,
      sort_order, tags, keys, active
    ) VALUES (
      v_draft_id,
      v_question_id,
      v_stable_id,
      v_values ->> 'text',
      (v_values ->> 'sortOrder')::integer,
      COALESCE(v_values -> 'tags', '[]'::jsonb),
      COALESCE(v_values -> 'keys', '[]'::jsonb),
      COALESCE((v_values ->> 'active')::boolean, true)
    );
  ELSIF v_entity_type = 'RECOMMENDATION_CREATE' THEN
    INSERT INTO public.recommendations (
      config_version_id, stable_id, type, title, description,
      url, status, tags, priority_tags, active
    ) VALUES (
      v_draft_id,
      v_stable_id,
      (v_values ->> 'type')::public.recommendation_type,
      v_values ->> 'title',
      v_values ->> 'description',
      NULLIF(v_values ->> 'url', ''),
      (v_values ->> 'status')::public.recommendation_status,
      COALESCE(v_values -> 'tags', '[]'::jsonb),
      COALESCE(v_values -> 'priorityTags', '[]'::jsonb),
      COALESCE((v_values ->> 'active')::boolean, true)
    );
  ELSIF v_entity_type = 'QUESTION' THEN
    UPDATE public.questions SET
      text = CASE WHEN v_values ? 'text' THEN v_values ->> 'text' ELSE text END,
      block = CASE WHEN v_values ? 'block' THEN v_values ->> 'block' ELSE block END,
      min_select = CASE WHEN v_values ? 'minSelect' THEN (v_values ->> 'minSelect')::integer ELSE min_select END,
      max_select = CASE WHEN v_values ? 'maxSelect' THEN (v_values ->> 'maxSelect')::integer ELSE max_select END,
      required = CASE WHEN v_values ? 'required' THEN (v_values ->> 'required')::boolean ELSE required END,
      sort_order = CASE WHEN v_values ? 'sortOrder' THEN (v_values ->> 'sortOrder')::integer ELSE sort_order END,
      active = CASE WHEN v_values ? 'active' THEN (v_values ->> 'active')::boolean ELSE active END,
      show_condition = CASE WHEN v_values ? 'showCondition' THEN v_values -> 'showCondition' ELSE show_condition END,
      updated_at = v_now
    WHERE config_version_id = v_draft_id AND stable_id = v_stable_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUESTION_NOT_FOUND'; END IF;
  ELSIF v_entity_type = 'ANSWER' THEN
    UPDATE public.answers SET
      text = CASE WHEN v_values ? 'text' THEN v_values ->> 'text' ELSE text END,
      sort_order = CASE WHEN v_values ? 'sortOrder' THEN (v_values ->> 'sortOrder')::integer ELSE sort_order END,
      tags = CASE WHEN v_values ? 'tags' THEN v_values -> 'tags' ELSE tags END,
      keys = CASE WHEN v_values ? 'keys' THEN v_values -> 'keys' ELSE keys END,
      active = CASE WHEN v_values ? 'active' THEN (v_values ->> 'active')::boolean ELSE active END,
      updated_at = v_now
    WHERE config_version_id = v_draft_id AND stable_id = v_stable_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_DATA_INVALID'; END IF;
  ELSIF v_entity_type = 'MODULE' THEN
    UPDATE public.modules SET
      name = CASE WHEN v_values ? 'name' THEN v_values ->> 'name' ELSE name END,
      goal = CASE WHEN v_values ? 'goal' THEN v_values ->> 'goal' ELSE goal END,
      step_1 = CASE WHEN v_values ? 'step1' THEN v_values ->> 'step1' ELSE step_1 END,
      step_2 = CASE WHEN v_values ? 'step2' THEN v_values ->> 'step2' ELSE step_2 END,
      step_3 = CASE WHEN v_values ? 'step3' THEN v_values ->> 'step3' ELSE step_3 END,
      checkpoint = CASE WHEN v_values ? 'checkpoint' THEN v_values ->> 'checkpoint' ELSE checkpoint END,
      constraints = CASE WHEN v_values ? 'constraints' THEN v_values ->> 'constraints' ELSE constraints END,
      sort_order = CASE WHEN v_values ? 'sortOrder' THEN (v_values ->> 'sortOrder')::integer ELSE sort_order END,
      active = CASE WHEN v_values ? 'active' THEN (v_values ->> 'active')::boolean ELSE active END,
      updated_at = v_now
    WHERE config_version_id = v_draft_id AND stable_id = v_stable_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_DATA_INVALID'; END IF;
  ELSIF v_entity_type = 'RECOMMENDATION' THEN
    UPDATE public.recommendations SET
      title = CASE WHEN v_values ? 'title' THEN v_values ->> 'title' ELSE title END,
      description = CASE WHEN v_values ? 'description' THEN v_values ->> 'description' ELSE description END,
      url = CASE WHEN v_values ? 'url' THEN NULLIF(v_values ->> 'url', '') ELSE url END,
      status = CASE WHEN v_values ? 'status' THEN (v_values ->> 'status')::public.recommendation_status ELSE status END,
      tags = CASE WHEN v_values ? 'tags' THEN v_values -> 'tags' ELSE tags END,
      priority_tags = CASE WHEN v_values ? 'priorityTags' THEN v_values -> 'priorityTags' ELSE priority_tags END,
      active = CASE WHEN v_values ? 'active' THEN (v_values ->> 'active')::boolean ELSE active END,
      updated_at = v_now
    WHERE config_version_id = v_draft_id AND stable_id = v_stable_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_DATA_INVALID'; END IF;
  ELSIF v_entity_type = 'OPPORTUNITY' THEN
    UPDATE public.opportunities SET
      type = CASE WHEN v_values ? 'type' THEN (v_values ->> 'type')::public.opportunity_type ELSE type END,
      title = CASE WHEN v_values ? 'title' THEN v_values ->> 'title' ELSE title END,
      description = CASE WHEN v_values ? 'description' THEN v_values ->> 'description' ELSE description END,
      url = CASE WHEN v_values ? 'url' THEN NULLIF(v_values ->> 'url', '') ELSE url END,
      starts_at = CASE WHEN v_values ? 'startsAt' THEN (v_values ->> 'startsAt')::timestamptz ELSE starts_at END,
      ends_at = CASE WHEN v_values ? 'endsAt' THEN (v_values ->> 'endsAt')::timestamptz ELSE ends_at END,
      valid_from = CASE WHEN v_values ? 'validFrom' THEN (v_values ->> 'validFrom')::timestamptz ELSE valid_from END,
      valid_to = CASE WHEN v_values ? 'validTo' THEN (v_values ->> 'validTo')::timestamptz ELSE valid_to END,
      tags = CASE WHEN v_values ? 'tags' THEN v_values -> 'tags' ELSE tags END,
      active = CASE WHEN v_values ? 'active' THEN (v_values ->> 'active')::boolean ELSE active END,
      updated_at = v_now
    WHERE config_version_id = v_draft_id AND stable_id = v_stable_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      IF NOT (v_values ? 'type' AND v_values ? 'title' AND v_values ? 'description') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
      END IF;
      INSERT INTO public.opportunities (
        config_version_id, stable_id, type, title, description, url,
        starts_at, ends_at, valid_from, valid_to, tags, active
      ) VALUES (
        v_draft_id,
        v_stable_id,
        (v_values ->> 'type')::public.opportunity_type,
        v_values ->> 'title',
        v_values ->> 'description',
        NULLIF(v_values ->> 'url', ''),
        (v_values ->> 'startsAt')::timestamptz,
        (v_values ->> 'endsAt')::timestamptz,
        (v_values ->> 'validFrom')::timestamptz,
        (v_values ->> 'validTo')::timestamptz,
        COALESCE(v_values -> 'tags', '[]'::jsonb),
        COALESCE((v_values ->> 'active')::boolean, true)
      );
    END IF;
  ELSIF v_entity_type = 'WEIGHT' THEN
    SELECT id INTO v_answer_id FROM public.answers
    WHERE config_version_id = v_draft_id
      AND stable_id = split_part(v_stable_id, ':', 1);
    SELECT id INTO v_module_id FROM public.modules
    WHERE config_version_id = v_draft_id
      AND stable_id = split_part(v_stable_id, ':', 2);
    IF v_answer_id IS NULL OR v_module_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WEIGHT_REFERENCE_NOT_FOUND';
    END IF;
    INSERT INTO public.answer_module_weights (
      config_version_id, answer_id, module_id, weight
    ) VALUES (
      v_draft_id, v_answer_id, v_module_id, (v_values ->> 'weight')::integer
    ) ON CONFLICT (config_version_id, answer_id, module_id)
      DO UPDATE SET weight = EXCLUDED.weight;
  ELSIF v_entity_type = 'RULE' THEN
    UPDATE public.engine_rules SET
      source_title = CASE WHEN v_values ? 'sourceTitle' THEN v_values ->> 'sourceTitle' ELSE source_title END,
      source_content = CASE WHEN v_values ? 'sourceContent' THEN v_values ->> 'sourceContent' ELSE source_content END,
      params = CASE WHEN v_values ? 'params' THEN v_values -> 'params' ELSE params END,
      active = CASE WHEN v_values ? 'active' THEN (v_values ->> 'active')::boolean ELSE active END,
      updated_at = v_now
    WHERE config_version_id = v_draft_id AND stable_id = v_stable_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_DATA_INVALID'; END IF;
  ELSIF v_entity_type = 'MODIFIER' THEN
    UPDATE public.modifiers SET
      effect = CASE WHEN v_values ? 'effect' THEN v_values -> 'effect' ELSE effect END,
      operation_params = CASE WHEN v_values ? 'operationParams' THEN v_values -> 'operationParams' ELSE operation_params END,
      active = CASE WHEN v_values ? 'active' THEN (v_values ->> 'active')::boolean ELSE active END,
      updated_at = v_now
    WHERE config_version_id = v_draft_id AND stable_id = v_stable_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_DATA_INVALID'; END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
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
    'DRAFT_ENTITY_UPDATED',
    v_entity_type,
    v_stable_id,
    p_audit
  );
  RETURN jsonb_build_object('id', v_draft_id, 'updatedAt', v_now);
END;
$$;

COMMIT;

SELECT count(*)::integer AS content_rpc_functions
FROM pg_proc AS procedure
JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname = 'public'
  AND procedure.proname = ANY (ARRAY['admin_get_draft', 'admin_mutate_draft']);
