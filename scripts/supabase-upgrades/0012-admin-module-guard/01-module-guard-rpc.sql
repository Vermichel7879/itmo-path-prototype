BEGIN;

ALTER TABLE "engine_rules" DROP CONSTRAINT "engine_rules_stable_id_format";
--> statement-breakpoint
ALTER TABLE "engine_rules" ADD CONSTRAINT "engine_rules_stable_id_format" CHECK ("engine_rules"."stable_id" ~ '^R(0[1-9]|[1-9][0-9]+)$');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.admin_create_module_guard(
  p_actor_user_id uuid,
  p_expected_updated_at timestamptz,
  p_expected_snapshot_hash text,
  p_stable_id text,
  p_values jsonb,
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
  v_stable_id text := trim(p_stable_id);
  v_module_id text;
  v_condition jsonb;
  v_condition_kind text;
  v_condition_values jsonb;
  v_scope text;
  v_sort_order integer;
  v_params jsonb;
  v_item jsonb;
  v_next_snapshot jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_actor_user_id IS NULL
     OR p_expected_updated_at IS NULL
     OR p_expected_snapshot_hash !~ '^[a-f0-9]{64}$'
     OR v_stable_id !~ '^R(1[89]|[2-9][0-9]|[1-9][0-9]{2,})$'
     OR jsonb_typeof(p_values) <> 'object'
     OR jsonb_typeof(p_audit) <> 'object'
     OR length(trim(COALESCE(p_values ->> 'sourceTitle', ''))) = 0
     OR length(trim(COALESCE(p_values ->> 'sourceContent', ''))) = 0
     OR COALESCE(p_values ->> 'moduleId', '') !~ '^M(0[1-9]|[1-9][0-9]+)$'
     OR jsonb_typeof(p_values -> 'allowPrimaryWhen') <> 'object'
     OR COALESCE(p_values ->> 'scope', '') NOT IN ('ALL_RANKING', 'PRIMARY_ONLY')
     OR jsonb_typeof(p_values -> 'sortOrder') <> 'number'
     OR (p_values ->> 'sortOrder')::integer <= 0
     OR jsonb_typeof(p_values -> 'active') <> 'boolean' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;

  v_module_id := p_values ->> 'moduleId';
  v_condition := p_values -> 'allowPrimaryWhen';
  v_condition_kind := v_condition ->> 'kind';
  v_scope := p_values ->> 'scope';
  v_sort_order := (p_values ->> 'sortOrder')::integer;

  IF v_condition_kind = 'ANY_ANSWER_ID' THEN
    v_condition_values := v_condition -> 'answerIds';
  ELSIF v_condition_kind = 'ANY_ANSWER_TAG' THEN
    v_condition_values := v_condition -> 'tags';
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;
  IF jsonb_typeof(v_condition_values) <> 'array'
     OR jsonb_array_length(v_condition_values) = 0
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_condition_values) value
       WHERE jsonb_typeof(value) <> 'string' OR length(trim(value #>> '{}')) = 0
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;

  SELECT role INTO v_actor_role
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

  IF EXISTS (
    SELECT 1 FROM public.engine_rules
    WHERE config_version_id = v_draft_id AND stable_id = v_stable_id
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_snapshot -> 'engineRules', '[]'::jsonb)) source(item)
    WHERE item ->> 'stableId' = v_stable_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RULE_ALREADY_EXISTS';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.engine_rules
    WHERE config_version_id = v_draft_id AND sort_order = v_sort_order
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_snapshot -> 'engineRules', '[]'::jsonb)) source(item)
    WHERE (item ->> 'sortOrder')::integer = v_sort_order
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RULE_SORT_ORDER_EXISTS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.modules
    WHERE config_version_id = v_draft_id AND stable_id = v_module_id
  ) OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_snapshot -> 'modules', '[]'::jsonb)) source(item)
    WHERE item ->> 'stableId' = v_module_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MODULE_NOT_FOUND';
  END IF;

  IF v_condition_kind = 'ANY_ANSWER_ID' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(v_condition_values) requested(answer_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.answers
      WHERE config_version_id = v_draft_id AND stable_id = requested.answer_id
    ) OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_snapshot -> 'answers', '[]'::jsonb)) source(item)
      WHERE item ->> 'stableId' = requested.answer_id
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ANSWER_NOT_FOUND';
  END IF;
  IF v_condition_kind = 'ANY_ANSWER_TAG' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(v_condition_values) requested(tag)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.answers answer,
           jsonb_array_elements_text(answer.tags) existing(tag)
      WHERE answer.config_version_id = v_draft_id AND existing.tag = requested.tag
    ) OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(v_snapshot -> 'answers', '[]'::jsonb)) source(item),
           jsonb_array_elements_text(COALESCE(source.item -> 'tags', '[]'::jsonb)) existing(tag)
      WHERE existing.tag = requested.tag
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ANSWER_TAG_NOT_FOUND';
  END IF;

  v_params := jsonb_build_object(
    'moduleId', v_module_id,
    'allowPrimaryWhen', v_condition,
    'blockedPolicy', 'REMOVE_FROM_PRIMARY_CANDIDATES',
    'scope', v_scope
  );
  INSERT INTO public.engine_rules (
    config_version_id,
    stable_id,
    rule_kind,
    params,
    source_title,
    source_content,
    sort_order,
    active
  ) VALUES (
    v_draft_id,
    v_stable_id,
    'MODULE_GUARD'::public.engine_rule_kind,
    v_params,
    trim(p_values ->> 'sourceTitle'),
    trim(p_values ->> 'sourceContent'),
    v_sort_order,
    (p_values ->> 'active')::boolean
  );

  v_item := jsonb_build_object(
    'stableId', v_stable_id,
    'sourceTitle', trim(p_values ->> 'sourceTitle'),
    'sourceContent', trim(p_values ->> 'sourceContent'),
    'sortOrder', v_sort_order,
    'active', (p_values ->> 'active')::boolean,
    'ruleKind', 'MODULE_GUARD',
    'params', v_params
  );
  v_next_snapshot := jsonb_set(
    v_snapshot,
    '{engineRules}',
    COALESCE(v_snapshot -> 'engineRules', '[]'::jsonb) || jsonb_build_array(v_item),
    false
  );

  UPDATE public.config_versions
  SET snapshot = v_next_snapshot, updated_at = v_now
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
    'DRAFT_MODULE_GUARD_CREATED',
    'RULE',
    v_stable_id,
    p_audit
  );

  RETURN jsonb_build_object('id', v_draft_id, 'updatedAt', v_now);
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb) TO service_role;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.admin_publish_draft(
  p_actor_user_id uuid,
  p_expected_updated_at timestamptz,
  p_expected_snapshot_hash text,
  p_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_role public.admin_role;
  v_draft public.config_versions%ROWTYPE;
  v_snapshot_hash text;
  v_version_number integer;
  v_published_id uuid;
  v_published_at timestamptz := clock_timestamp();
BEGIN
  IF p_actor_user_id IS NULL
     OR p_expected_updated_at IS NULL
     OR p_expected_snapshot_hash !~ '^[a-f0-9]{64}$'
     OR length(trim(p_label)) = 0
     OR length(trim(p_label)) > 180 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;
  SELECT role INTO v_actor_role
  FROM public.admin_users
  WHERE id = p_actor_user_id AND active = true;
  IF v_actor_role IS DISTINCT FROM 'ADMIN'::public.admin_role THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_ACTOR_INVALID';
  END IF;

  LOCK TABLE public.config_versions IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO v_draft
  FROM public.config_versions
  WHERE status = 'DRAFT'
  FOR UPDATE;
  IF v_draft.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DRAFT_CONFIG_MISSING';
  END IF;
  v_snapshot_hash := encode(
    extensions.digest(convert_to(v_draft.snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_draft.updated_at <> p_expected_updated_at
     OR v_snapshot_hash <> p_expected_snapshot_hash THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DRAFT_STALE_REVISION';
  END IF;
  IF jsonb_typeof(v_draft.snapshot) <> 'object'
     OR jsonb_typeof(v_draft.snapshot -> 'questions') <> 'array'
     OR jsonb_typeof(v_draft.snapshot -> 'answers') <> 'array'
     OR jsonb_typeof(v_draft.snapshot -> 'modules') <> 'array'
     OR jsonb_typeof(v_draft.snapshot -> 'engineRules') <> 'array'
     OR jsonb_array_length(v_draft.snapshot -> 'questions') = 0
     OR jsonb_array_length(v_draft.snapshot -> 'answers') = 0
     OR jsonb_array_length(v_draft.snapshot -> 'modules') = 0
     OR jsonb_array_length(v_draft.snapshot -> 'engineRules') < 17
     OR (
       SELECT count(DISTINCT item ->> 'stableId')
       FROM jsonb_array_elements(v_draft.snapshot -> 'engineRules') item
       WHERE item ->> 'stableId' = ANY(ARRAY[
         'R01','R02','R03','R04','R05','R06','R07','R08','R09',
         'R10','R11','R12','R13','R14','R15','R16','R17'
       ])
     ) <> 17
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_draft.snapshot -> 'engineRules') item
       WHERE item ->> 'stableId' <> ALL(ARRAY[
         'R01','R02','R03','R04','R05','R06','R07','R08','R09',
         'R10','R11','R12','R13','R14','R15','R16','R17'
       ])
       AND item ->> 'ruleKind' <> 'MODULE_GUARD'
     ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PUBLISH_BLOCKED_BY_VALIDATION';
  END IF;

  SELECT COALESCE(max(version_number), 0) + 1
  INTO v_version_number
  FROM public.config_versions;
  INSERT INTO public.config_versions (
    version_number,
    status,
    label,
    source_file_name,
    source_sha256,
    snapshot,
    created_by_admin_user_id,
    published_by_admin_user_id,
    published_at
  ) VALUES (
    v_version_number,
    'PUBLISHED',
    trim(p_label),
    v_draft.source_file_name,
    v_draft.source_sha256,
    v_draft.snapshot,
    p_actor_user_id,
    p_actor_user_id,
    v_published_at
  ) RETURNING id INTO v_published_id;

  UPDATE public.config_versions
  SET updated_at = v_published_at
  WHERE id = v_draft.id;
  INSERT INTO public.audit_log (
    actor_admin_user_id,
    config_version_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_actor_user_id,
    v_published_id,
    'CONFIG_PUBLISHED',
    'CONFIG_VERSION',
    v_published_id::text,
    jsonb_build_object(
      'versionNumber', v_version_number,
      'draftId', v_draft.id
    )
  );
  RETURN jsonb_build_object(
    'id', v_published_id,
    'versionNumber', v_version_number,
    'publishedAt', v_published_at
  );
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admin_publish_draft(uuid,timestamptz,text,text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_publish_draft(uuid,timestamptz,text,text) TO service_role;

COMMIT;

SELECT
  to_regprocedure('public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb)') IS NOT NULL
    AS module_guard_create_rpc_exists,
  has_function_privilege('service_role', 'public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE')
    AS service_role_execute,
  NOT has_function_privilege('anon', 'public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE')
    AS anon_execute_denied,
  NOT has_function_privilege('authenticated', 'public.admin_create_module_guard(uuid,timestamptz,text,text,jsonb,jsonb)', 'EXECUTE')
    AS authenticated_execute_denied,
  pg_get_constraintdef(oid) LIKE '%[1-9][0-9]+%'
    AS extended_rule_id_constraint
FROM pg_constraint
WHERE conname = 'engine_rules_stable_id_format';
