CREATE OR REPLACE FUNCTION public.admin_replace_snapshot_item(
  p_snapshot jsonb,
  p_collection text,
  p_stable_id text,
  p_item jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_items jsonb;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      CASE WHEN item ->> 'stableId' = p_stable_id THEN p_item ELSE item END
      ORDER BY ordinal
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM jsonb_array_elements(COALESCE(p_snapshot -> p_collection, '[]'::jsonb))
    WITH ORDINALITY AS source(item, ordinal);
  RETURN jsonb_set(p_snapshot, ARRAY[p_collection], v_items, false);
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.admin_apply_draft_snapshot_mutation(
  p_snapshot jsonb,
  p_mutation jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_next jsonb := p_snapshot;
  v_entity_type text := p_mutation ->> 'entityType';
  v_stable_id text := p_mutation ->> 'stableId';
  v_values jsonb := p_mutation -> 'values';
  v_item jsonb;
  v_answer jsonb;
  v_module jsonb;
  v_recommendation jsonb;
  v_items jsonb;
  v_answer_stable_id text;
  v_module_stable_id text;
  v_recommendation_stable_id text;
BEGIN
  IF jsonb_typeof(p_snapshot) <> 'object'
     OR jsonb_typeof(p_mutation) <> 'object'
     OR v_entity_type IS NULL
     OR length(trim(v_stable_id)) = 0
     OR jsonb_typeof(v_values) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;

  IF v_entity_type = 'QUESTION_CREATE' THEN
    v_item := jsonb_build_object(
      'stableId', v_stable_id,
      'block', v_values -> 'block',
      'text', v_values -> 'text',
      'selectionType', v_values -> 'selectionType',
      'minSelect', v_values -> 'minSelect',
      'maxSelect', v_values -> 'maxSelect',
      'required', v_values -> 'required',
      'sortOrder', v_values -> 'sortOrder',
      'showCondition', v_values -> 'showCondition',
      'active', true,
      'forBachelor', COALESCE(v_values -> 'forBachelor', 'false'::jsonb),
      'forMaster', COALESCE(v_values -> 'forMaster', 'true'::jsonb)
    );
    v_next := jsonb_set(
      v_next,
      '{questions}',
      COALESCE(v_next -> 'questions', '[]'::jsonb) || jsonb_build_array(v_item),
      false
    );
    v_item := jsonb_build_object(
      'stableId', v_values #> '{firstAnswer,stableId}',
      'questionStableId', v_stable_id,
      'text', v_values #> '{firstAnswer,text}',
      'sortOrder', 1,
      'tags', '[]'::jsonb,
      'keys', '[]'::jsonb,
      'active', true
    );
    RETURN jsonb_set(
      v_next,
      '{answers}',
      COALESCE(v_next -> 'answers', '[]'::jsonb) || jsonb_build_array(v_item),
      false
    );
  ELSIF v_entity_type = 'ANSWER_CREATE' THEN
    v_item := jsonb_build_object('stableId', v_stable_id) || v_values;
    RETURN jsonb_set(
      v_next,
      '{answers}',
      COALESCE(v_next -> 'answers', '[]'::jsonb) || jsonb_build_array(v_item),
      false
    );
  ELSIF v_entity_type = 'RECOMMENDATION_CREATE' THEN
    v_item := jsonb_build_object('stableId', v_stable_id) || v_values;
    RETURN jsonb_set(
      v_next,
      '{recommendations}',
      COALESCE(v_next -> 'recommendations', '[]'::jsonb) || jsonb_build_array(v_item),
      false
    );
  ELSIF v_entity_type = 'QUESTION' THEN
    SELECT item INTO v_item
    FROM jsonb_array_elements(COALESCE(v_next -> 'questions', '[]'::jsonb)) AS source(item)
    WHERE item ->> 'stableId' = v_stable_id;
    IF v_item IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUESTION_NOT_FOUND'; END IF;
    RETURN public.admin_replace_snapshot_item(v_next, 'questions', v_stable_id, v_item || v_values);
  ELSIF v_entity_type = 'ANSWER' THEN
    SELECT item INTO v_item
    FROM jsonb_array_elements(COALESCE(v_next -> 'answers', '[]'::jsonb)) AS source(item)
    WHERE item ->> 'stableId' = v_stable_id;
    IF v_item IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ANSWER_NOT_FOUND'; END IF;
    RETURN public.admin_replace_snapshot_item(v_next, 'answers', v_stable_id, v_item || v_values);
  ELSIF v_entity_type = 'MODULE' THEN
    SELECT item INTO v_item
    FROM jsonb_array_elements(COALESCE(v_next -> 'modules', '[]'::jsonb)) AS source(item)
    WHERE item ->> 'stableId' = v_stable_id;
    IF v_item IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MODULE_NOT_FOUND'; END IF;
    v_item := v_item || (v_values - 'step1' - 'step2' - 'step3');
    IF v_values ? 'step1' THEN v_item := jsonb_set(v_item, '{steps,0}', v_values -> 'step1', false); END IF;
    IF v_values ? 'step2' THEN v_item := jsonb_set(v_item, '{steps,1}', v_values -> 'step2', false); END IF;
    IF v_values ? 'step3' THEN v_item := jsonb_set(v_item, '{steps,2}', v_values -> 'step3', false); END IF;
    RETURN public.admin_replace_snapshot_item(v_next, 'modules', v_stable_id, v_item);
  ELSIF v_entity_type = 'RECOMMENDATION' THEN
    SELECT item INTO v_item
    FROM jsonb_array_elements(COALESCE(v_next -> 'recommendations', '[]'::jsonb)) AS source(item)
    WHERE item ->> 'stableId' = v_stable_id;
    IF v_item IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECOMMENDATION_NOT_FOUND'; END IF;
    RETURN public.admin_replace_snapshot_item(v_next, 'recommendations', v_stable_id, v_item || v_values);
  ELSIF v_entity_type = 'OPPORTUNITY' THEN
    SELECT item INTO v_item
    FROM jsonb_array_elements(COALESCE(v_next -> 'opportunities', '[]'::jsonb)) AS source(item)
    WHERE item ->> 'stableId' = v_stable_id;
    IF v_item IS NULL THEN
      IF NOT (v_values ? 'type' AND v_values ? 'title' AND v_values ? 'description') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OPPORTUNITY_CREATE_FIELDS_REQUIRED';
      END IF;
      v_item := jsonb_build_object(
        'stableId', v_stable_id,
        'type', v_values -> 'type',
        'title', v_values -> 'title',
        'description', v_values -> 'description',
        'url', COALESCE(v_values -> 'url', 'null'::jsonb),
        'startsAt', COALESCE(v_values -> 'startsAt', 'null'::jsonb),
        'endsAt', COALESCE(v_values -> 'endsAt', 'null'::jsonb),
        'validFrom', COALESCE(v_values -> 'validFrom', 'null'::jsonb),
        'validTo', COALESCE(v_values -> 'validTo', 'null'::jsonb),
        'tags', COALESCE(v_values -> 'tags', '[]'::jsonb),
        'active', COALESCE(v_values -> 'active', 'true'::jsonb)
      );
      RETURN jsonb_set(
        v_next,
        '{opportunities}',
        COALESCE(v_next -> 'opportunities', '[]'::jsonb) || jsonb_build_array(v_item),
        false
      );
    END IF;
    RETURN public.admin_replace_snapshot_item(v_next, 'opportunities', v_stable_id, v_item || v_values);
  ELSIF v_entity_type = 'RULE' THEN
    SELECT item INTO v_item
    FROM jsonb_array_elements(COALESCE(v_next -> 'engineRules', '[]'::jsonb)) AS source(item)
    WHERE item ->> 'stableId' = v_stable_id;
    IF v_item IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_DATA_INVALID'; END IF;
    RETURN public.admin_replace_snapshot_item(v_next, 'engineRules', v_stable_id, v_item || v_values);
  ELSIF v_entity_type = 'MODIFIER' THEN
    SELECT item INTO v_item
    FROM jsonb_array_elements(COALESCE(v_next -> 'modifiers', '[]'::jsonb)) AS source(item)
    WHERE item ->> 'stableId' = v_stable_id;
    IF v_item IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_DATA_INVALID'; END IF;
    IF v_values ? 'effect' THEN v_item := jsonb_set(v_item, '{effect}', v_values -> 'effect', false); END IF;
    IF v_values ? 'operationParams' THEN v_item := jsonb_set(v_item, '{operation,params}', v_values -> 'operationParams', false); END IF;
    IF v_values ? 'active' THEN v_item := v_item || jsonb_build_object('active', v_values -> 'active'); END IF;
    RETURN public.admin_replace_snapshot_item(v_next, 'modifiers', v_stable_id, v_item);
  ELSIF v_entity_type = 'WEIGHT' OR v_entity_type LIKE 'MAPPING_%' THEN
    v_answer_stable_id := split_part(v_stable_id, ':', 1);
    v_module_stable_id := split_part(v_stable_id, ':', 2);
    SELECT item INTO v_answer
    FROM jsonb_array_elements(COALESCE(v_next -> 'answers', '[]'::jsonb)) AS source(item)
    WHERE item ->> 'stableId' = v_answer_stable_id;
    IF v_answer IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = CASE WHEN v_entity_type = 'WEIGHT' THEN 'WEIGHT_REFERENCE_NOT_FOUND' ELSE 'ANSWER_NOT_FOUND' END;
    END IF;
    SELECT item INTO v_module
    FROM jsonb_array_elements(COALESCE(v_next -> 'modules', '[]'::jsonb)) AS source(item)
    WHERE item ->> 'stableId' = v_module_stable_id;
    IF v_module IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = CASE WHEN v_entity_type = 'WEIGHT' THEN 'WEIGHT_REFERENCE_NOT_FOUND' ELSE 'MODULE_NOT_FOUND' END;
    END IF;
    SELECT item INTO v_item
    FROM jsonb_array_elements(COALESCE(v_next -> 'mappings', '[]'::jsonb)) AS source(item)
    WHERE item ->> 'answerStableId' = v_answer_stable_id
      AND item ->> 'moduleStableId' = v_module_stable_id;
    IF v_entity_type = 'MAPPING_CREATE' THEN
      IF v_item IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MAPPING_ALREADY_EXISTS'; END IF;
      v_item := jsonb_build_object(
        'answerStableId', v_answer_stable_id,
        'questionStableId', v_answer ->> 'questionStableId',
        'moduleStableId', v_module_stable_id,
        'weight', v_values -> 'weight'
      );
      RETURN jsonb_set(v_next, '{mappings}', COALESCE(v_next -> 'mappings', '[]'::jsonb) || jsonb_build_array(v_item), false);
    ELSIF v_entity_type = 'MAPPING_DELETE' THEN
      IF v_item IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MAPPING_NOT_FOUND'; END IF;
      SELECT COALESCE(jsonb_agg(item ORDER BY ordinal), '[]'::jsonb) INTO v_items
      FROM jsonb_array_elements(COALESCE(v_next -> 'mappings', '[]'::jsonb)) WITH ORDINALITY AS source(item, ordinal)
      WHERE NOT (item ->> 'answerStableId' = v_answer_stable_id AND item ->> 'moduleStableId' = v_module_stable_id);
      RETURN jsonb_set(v_next, '{mappings}', v_items, false);
    ELSE
      IF v_item IS NULL THEN
        IF v_entity_type = 'MAPPING_UPDATE' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MAPPING_NOT_FOUND'; END IF;
        v_item := jsonb_build_object(
          'answerStableId', v_answer_stable_id,
          'questionStableId', v_answer ->> 'questionStableId',
          'moduleStableId', v_module_stable_id,
          'weight', v_values -> 'weight'
        );
        RETURN jsonb_set(v_next, '{mappings}', COALESCE(v_next -> 'mappings', '[]'::jsonb) || jsonb_build_array(v_item), false);
      END IF;
      SELECT jsonb_agg(
        CASE
          WHEN item ->> 'answerStableId' = v_answer_stable_id AND item ->> 'moduleStableId' = v_module_stable_id
            THEN item || jsonb_build_object('weight', v_values -> 'weight')
          ELSE item
        END ORDER BY ordinal
      ) INTO v_items
      FROM jsonb_array_elements(COALESCE(v_next -> 'mappings', '[]'::jsonb)) WITH ORDINALITY AS source(item, ordinal);
      RETURN jsonb_set(v_next, '{mappings}', v_items, false);
    END IF;
  ELSIF v_entity_type LIKE 'MODULE_RECOMMENDATION_%' THEN
    v_module_stable_id := split_part(v_stable_id, ':', 1);
    v_recommendation_stable_id := split_part(v_stable_id, ':', 2);
    SELECT item INTO v_module
    FROM jsonb_array_elements(COALESCE(v_next -> 'modules', '[]'::jsonb)) AS source(item)
    WHERE item ->> 'stableId' = v_module_stable_id;
    IF v_module IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MODULE_NOT_FOUND'; END IF;
    SELECT item INTO v_recommendation
    FROM jsonb_array_elements(COALESCE(v_next -> 'recommendations', '[]'::jsonb)) AS source(item)
    WHERE item ->> 'stableId' = v_recommendation_stable_id;
    IF v_recommendation IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECOMMENDATION_NOT_FOUND'; END IF;
    SELECT item INTO v_item
    FROM jsonb_array_elements(COALESCE(v_next -> 'moduleRecommendations', '[]'::jsonb)) AS source(item)
    WHERE item ->> 'moduleStableId' = v_module_stable_id
      AND item ->> 'recommendationStableId' = v_recommendation_stable_id;
    IF v_entity_type = 'MODULE_RECOMMENDATION_CREATE' THEN
      IF v_item IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MODULE_RECOMMENDATION_ALREADY_EXISTS'; END IF;
      v_item := jsonb_build_object(
        'moduleStableId', v_module_stable_id,
        'recommendationStableId', v_recommendation_stable_id,
        'priority', v_values -> 'priority'
      );
      RETURN jsonb_set(v_next, '{moduleRecommendations}', COALESCE(v_next -> 'moduleRecommendations', '[]'::jsonb) || jsonb_build_array(v_item), false);
    ELSIF v_entity_type = 'MODULE_RECOMMENDATION_DELETE' THEN
      IF v_item IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MODULE_RECOMMENDATION_NOT_FOUND'; END IF;
      SELECT COALESCE(jsonb_agg(item ORDER BY ordinal), '[]'::jsonb) INTO v_items
      FROM jsonb_array_elements(COALESCE(v_next -> 'moduleRecommendations', '[]'::jsonb)) WITH ORDINALITY AS source(item, ordinal)
      WHERE NOT (item ->> 'moduleStableId' = v_module_stable_id AND item ->> 'recommendationStableId' = v_recommendation_stable_id);
      RETURN jsonb_set(v_next, '{moduleRecommendations}', v_items, false);
    ELSE
      IF v_item IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MODULE_RECOMMENDATION_NOT_FOUND'; END IF;
      SELECT jsonb_agg(
        CASE
          WHEN item ->> 'moduleStableId' = v_module_stable_id AND item ->> 'recommendationStableId' = v_recommendation_stable_id
            THEN item || jsonb_build_object('priority', v_values -> 'priority')
          ELSE item
        END ORDER BY ordinal
      ) INTO v_items
      FROM jsonb_array_elements(COALESCE(v_next -> 'moduleRecommendations', '[]'::jsonb)) WITH ORDINALITY AS source(item, ordinal);
      RETURN jsonb_set(v_next, '{moduleRecommendations}', v_items, false);
    END IF;
  END IF;

  RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.admin_mutate_draft(
  p_actor_user_id uuid,
  p_expected_updated_at timestamptz,
  p_expected_snapshot_hash text,
  p_mutation jsonb,
  p_audit jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_draft_id uuid;
  v_updated_at timestamptz;
  v_snapshot jsonb;
  v_snapshot_hash text;
  v_next_snapshot jsonb;
  v_entity_type text;
  v_stable_id text;
  v_values jsonb;
  v_operation text;
BEGIN
  IF p_actor_user_id IS NULL
     OR p_expected_updated_at IS NULL
     OR p_expected_snapshot_hash !~ '^[a-f0-9]{64}$'
     OR jsonb_typeof(p_mutation) <> 'object'
     OR jsonb_typeof(p_audit) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
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

  v_entity_type := p_mutation ->> 'entityType';
  v_stable_id := p_mutation ->> 'stableId';
  v_values := p_mutation -> 'values';
  v_next_snapshot := public.admin_apply_draft_snapshot_mutation(v_snapshot, p_mutation);

  IF v_entity_type IN ('MAPPING_CREATE', 'MAPPING_UPDATE', 'MAPPING_DELETE') THEN
    v_operation := split_part(v_entity_type, '_', 2);
    RETURN public.admin_mutate_mapping(
      p_actor_user_id,
      p_expected_updated_at,
      p_expected_snapshot_hash,
      v_operation,
      split_part(v_stable_id, ':', 1),
      split_part(v_stable_id, ':', 2),
      CASE WHEN v_operation = 'DELETE' THEN NULL ELSE (v_values ->> 'weight')::integer END,
      v_next_snapshot,
      p_audit
    );
  ELSIF v_entity_type IN (
    'MODULE_RECOMMENDATION_CREATE',
    'MODULE_RECOMMENDATION_UPDATE',
    'MODULE_RECOMMENDATION_DELETE'
  ) THEN
    v_operation := CASE
      WHEN v_entity_type = 'MODULE_RECOMMENDATION_CREATE' THEN 'CREATE'
      WHEN v_entity_type = 'MODULE_RECOMMENDATION_UPDATE' THEN 'UPDATE'
      ELSE 'DELETE'
    END;
    RETURN public.admin_mutate_module_recommendation(
      p_actor_user_id,
      p_expected_updated_at,
      p_expected_snapshot_hash,
      v_operation,
      split_part(v_stable_id, ':', 1),
      split_part(v_stable_id, ':', 2),
      CASE WHEN v_operation = 'DELETE' THEN NULL ELSE (v_values ->> 'priority')::integer END,
      v_next_snapshot,
      p_audit
    );
  END IF;

  RETURN public.admin_mutate_draft(
    p_actor_user_id,
    p_expected_updated_at,
    p_expected_snapshot_hash,
    p_mutation,
    v_next_snapshot,
    p_audit
  );
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admin_replace_snapshot_item(jsonb,text,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admin_apply_draft_snapshot_mutation(jsonb,jsonb) FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb,jsonb) FROM service_role;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb) FROM service_role;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.admin_mutate_module_recommendation(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb) FROM service_role;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb) TO service_role;
