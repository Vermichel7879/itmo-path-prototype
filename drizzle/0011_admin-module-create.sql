CREATE OR REPLACE FUNCTION public.admin_create_module(
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
  v_item jsonb;
  v_next_snapshot jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_actor_user_id IS NULL
     OR p_expected_updated_at IS NULL
     OR p_expected_snapshot_hash !~ '^[a-f0-9]{64}$'
     OR v_stable_id !~ '^M(0[1-9]|[1-9][0-9]+)$'
     OR jsonb_typeof(p_values) <> 'object'
     OR jsonb_typeof(p_audit) <> 'object'
     OR length(trim(COALESCE(p_values ->> 'name', ''))) = 0
     OR length(trim(COALESCE(p_values ->> 'goal', ''))) = 0
     OR length(trim(COALESCE(p_values ->> 'step1', ''))) = 0
     OR length(trim(COALESCE(p_values ->> 'step2', ''))) = 0
     OR length(trim(COALESCE(p_values ->> 'step3', ''))) = 0
     OR length(trim(COALESCE(p_values ->> 'checkpoint', ''))) = 0
     OR jsonb_typeof(p_values -> 'constraints') <> 'string'
     OR jsonb_typeof(p_values -> 'sortOrder') <> 'number'
     OR (p_values ->> 'sortOrder')::integer <= 0
     OR jsonb_typeof(p_values -> 'active') <> 'boolean'
     OR jsonb_typeof(p_values -> 'forBachelor') <> 'boolean'
     OR jsonb_typeof(p_values -> 'forMaster') <> 'boolean'
     OR (
       (p_values ->> 'active')::boolean
       AND NOT (
         (p_values ->> 'forBachelor')::boolean
         OR (p_values ->> 'forMaster')::boolean
       )
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
    SELECT 1
    FROM public.modules
    WHERE config_version_id = v_draft_id AND stable_id = v_stable_id
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_snapshot -> 'modules', '[]'::jsonb)) source(item)
    WHERE item ->> 'stableId' = v_stable_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MODULE_ALREADY_EXISTS';
  END IF;

  INSERT INTO public.modules (
    config_version_id,
    stable_id,
    name,
    goal,
    step_1,
    step_2,
    step_3,
    checkpoint,
    constraints,
    sort_order,
    active,
    for_bachelor,
    for_master
  ) VALUES (
    v_draft_id,
    v_stable_id,
    trim(p_values ->> 'name'),
    trim(p_values ->> 'goal'),
    trim(p_values ->> 'step1'),
    trim(p_values ->> 'step2'),
    trim(p_values ->> 'step3'),
    trim(p_values ->> 'checkpoint'),
    trim(p_values ->> 'constraints'),
    (p_values ->> 'sortOrder')::integer,
    (p_values ->> 'active')::boolean,
    (p_values ->> 'forBachelor')::boolean,
    (p_values ->> 'forMaster')::boolean
  );

  v_item := jsonb_build_object(
    'stableId', v_stable_id,
    'name', trim(p_values ->> 'name'),
    'goal', trim(p_values ->> 'goal'),
    'steps', jsonb_build_array(
      trim(p_values ->> 'step1'),
      trim(p_values ->> 'step2'),
      trim(p_values ->> 'step3')
    ),
    'checkpoint', trim(p_values ->> 'checkpoint'),
    'recommendationStableIds', '[]'::jsonb,
    'constraints', trim(p_values ->> 'constraints'),
    'sortOrder', (p_values ->> 'sortOrder')::integer,
    'active', (p_values ->> 'active')::boolean,
    'forBachelor', (p_values ->> 'forBachelor')::boolean,
    'forMaster', (p_values ->> 'forMaster')::boolean
  );
  v_next_snapshot := jsonb_set(
    v_snapshot,
    '{modules}',
    COALESCE(v_snapshot -> 'modules', '[]'::jsonb) || jsonb_build_array(v_item),
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
    'DRAFT_MODULE_CREATED',
    'MODULE',
    v_stable_id,
    p_audit
  );

  RETURN jsonb_build_object('id', v_draft_id, 'updatedAt', v_now);
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admin_create_module(uuid,timestamptz,text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_create_module(uuid,timestamptz,text,text,jsonb,jsonb) TO service_role;

