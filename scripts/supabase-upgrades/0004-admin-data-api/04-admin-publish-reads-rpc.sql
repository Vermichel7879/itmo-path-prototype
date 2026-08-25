BEGIN;

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
     OR jsonb_array_length(v_draft.snapshot -> 'engineRules') <> 17 THEN
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

CREATE OR REPLACE FUNCTION public.admin_get_latest_published_summary()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT jsonb_build_object(
      'id', config.id,
      'versionNumber', config.version_number,
      'publishedAt', config.published_at
    )
    FROM public.config_versions AS config
    WHERE config.status = 'PUBLISHED'
    ORDER BY config.published_at DESC, config.version_number DESC
    LIMIT 1
  ), 'null'::jsonb)
$$;

CREATE OR REPLACE FUNCTION public.admin_get_latest_published_snapshot()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT jsonb_build_object('id', config.id, 'snapshot', config.snapshot)
    FROM public.config_versions AS config
    WHERE config.status = 'PUBLISHED'
    ORDER BY config.published_at DESC, config.version_number DESC
    LIMIT 1
  ), 'null'::jsonb)
$$;

CREATE OR REPLACE FUNCTION public.admin_list_versions()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', config.id,
        'versionNumber', config.version_number,
        'status', config.status,
        'label', config.label,
        'createdAt', config.created_at,
        'publishedAt', config.published_at,
        'publisher', publisher.username
      ) ORDER BY config.version_number DESC
    ),
    '[]'::jsonb
  )
  FROM public.config_versions AS config
  LEFT JOIN public.admin_users AS publisher
    ON publisher.id = config.published_by_admin_user_id
$$;

CREATE OR REPLACE FUNCTION public.admin_list_audit(
  p_username text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(entry.payload ORDER BY entry.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      audit.created_at,
      jsonb_build_object(
        'id', audit.id,
        'time', audit.created_at,
        'username', admin_user.username,
        'action', audit.action,
        'entityType', audit.entity_type,
        'entityId', audit.entity_id,
        'metadata', audit.metadata
      ) AS payload
    FROM public.audit_log AS audit
    LEFT JOIN public.admin_users AS admin_user
      ON admin_user.id = audit.actor_admin_user_id
    WHERE (p_username IS NULL OR admin_user.username ILIKE '%' || p_username || '%')
      AND (p_entity_type IS NULL OR audit.entity_type = p_entity_type)
      AND (p_action IS NULL OR audit.action ILIKE '%' || p_action || '%')
      AND (p_from IS NULL OR audit.created_at >= p_from)
      AND (p_to IS NULL OR audit.created_at <= p_to)
    ORDER BY audit.created_at DESC
    LIMIT 200
  ) AS entry
$$;

COMMIT;

SELECT count(*)::integer AS publish_read_rpc_functions
FROM pg_proc AS procedure
JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname = 'public'
  AND procedure.proname = ANY (ARRAY[
    'admin_publish_draft',
    'admin_get_latest_published_summary',
    'admin_get_latest_published_snapshot',
    'admin_list_versions',
    'admin_list_audit'
  ]);
