-- SOURCE CHUNK: scripts/supabase-upgrades/0004-admin-data-api/01-admin-auth-rpc.sql
CREATE OR REPLACE FUNCTION public.admin_get_login_context(
  p_username text,
  p_username_hash text,
  p_ip_hash text,
  p_window_start timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_failures integer;
  v_user jsonb;
BEGIN
  IF p_username IS NULL OR length(trim(p_username)) < 3
     OR p_username_hash !~ '^[a-f0-9]{64}$'
     OR p_ip_hash !~ '^[a-f0-9]{64}$'
     OR p_window_start IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;

  SELECT count(*)::integer
  INTO v_failures
  FROM public.admin_login_attempts AS attempt
  WHERE attempt.succeeded = false
    AND attempt.attempted_at > p_window_start
    AND (
      attempt.username_hash = p_username_hash
      OR attempt.ip_hash = p_ip_hash
    );

  SELECT jsonb_build_object(
    'id', admin_user.id,
    'username', admin_user.username,
    'passwordHash', admin_user.password_hash,
    'role', admin_user.role,
    'active', admin_user.active
  )
  INTO v_user
  FROM public.admin_users AS admin_user
  WHERE admin_user.username = lower(trim(p_username))
  LIMIT 1;

  RETURN jsonb_build_object(
    'failureCount', v_failures,
    'user', COALESCE(v_user, 'null'::jsonb)
  );
END;
$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.admin_record_failed_login(
  p_username_hash text,
  p_ip_hash text,
  p_attempted_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_username_hash !~ '^[a-f0-9]{64}$'
     OR p_ip_hash !~ '^[a-f0-9]{64}$'
     OR p_attempted_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;
  INSERT INTO public.admin_login_attempts (
    username_hash,
    ip_hash,
    succeeded,
    attempted_at
  ) VALUES (p_username_hash, p_ip_hash, false, p_attempted_at);
  RETURN jsonb_build_object('ok', true);
END;
$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.admin_complete_login(
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_username_hash text,
  p_ip_hash text,
  p_attempted_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session_id uuid;
  v_active boolean;
BEGIN
  IF p_user_id IS NULL
     OR length(trim(p_token_hash)) < 32
     OR p_expires_at <= p_attempted_at
     OR p_username_hash !~ '^[a-f0-9]{64}$'
     OR p_ip_hash !~ '^[a-f0-9]{64}$'
     OR p_attempted_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;

  SELECT active
  INTO v_active
  FROM public.admin_users
  WHERE id = p_user_id
  FOR UPDATE;
  IF v_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_ACTOR_INVALID';
  END IF;

  INSERT INTO public.admin_login_attempts (
    username_hash,
    ip_hash,
    succeeded,
    attempted_at
  ) VALUES (p_username_hash, p_ip_hash, true, p_attempted_at);

  INSERT INTO public.admin_sessions (token_hash, user_id, expires_at)
  VALUES (p_token_hash, p_user_id, p_expires_at)
  RETURNING id INTO v_session_id;

  UPDATE public.admin_users
  SET last_login_at = p_attempted_at,
      updated_at = p_attempted_at
  WHERE id = p_user_id;

  INSERT INTO public.audit_log (
    actor_admin_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_user_id,
    'ADMIN_LOGIN',
    'ADMIN_SESSION',
    v_session_id::text,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('sessionId', v_session_id);
END;
$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.admin_resolve_session(
  p_token_hash text,
  p_now timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_session jsonb;
BEGIN
  IF length(trim(p_token_hash)) < 32 OR p_now IS NULL THEN
    RETURN 'null'::jsonb;
  END IF;
  SELECT jsonb_build_object(
    'sessionId', session.id,
    'userId', admin_user.id,
    'username', admin_user.username,
    'role', admin_user.role,
    'expiresAt', session.expires_at
  )
  INTO v_session
  FROM public.admin_sessions AS session
  JOIN public.admin_users AS admin_user ON admin_user.id = session.user_id
  WHERE session.token_hash = p_token_hash
    AND session.revoked_at IS NULL
    AND session.expires_at > p_now
    AND admin_user.active = true
  ORDER BY session.created_at DESC
  LIMIT 1;
  RETURN COALESCE(v_session, 'null'::jsonb);
END;
$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.admin_revoke_session(
  p_token_hash text,
  p_revoked_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session_id uuid;
  v_user_id uuid;
BEGIN
  IF length(trim(p_token_hash)) < 32 OR p_revoked_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;
  UPDATE public.admin_sessions
  SET revoked_at = p_revoked_at
  WHERE token_hash = p_token_hash
    AND revoked_at IS NULL
  RETURNING id, user_id INTO v_session_id, v_user_id;

  IF v_session_id IS NOT NULL THEN
    INSERT INTO public.audit_log (
      actor_admin_user_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) VALUES (
      v_user_id,
      'ADMIN_LOGOUT',
      'ADMIN_SESSION',
      v_session_id::text,
      '{}'::jsonb
    );
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.admin_get_user_auth(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_user jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'passwordHash', password_hash,
    'active', active
  )
  INTO v_user
  FROM public.admin_users
  WHERE id = p_user_id;
  RETURN COALESCE(v_user, 'null'::jsonb);
END;
$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.admin_change_password(
  p_actor_user_id uuid,
  p_password_hash text,
  p_changed_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_actor_user_id IS NULL
     OR length(trim(p_password_hash)) < 20
     OR p_changed_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;
  UPDATE public.admin_users
  SET password_hash = p_password_hash,
      updated_at = p_changed_at
  WHERE id = p_actor_user_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_ACTOR_INVALID';
  END IF;
  UPDATE public.admin_sessions
  SET revoked_at = p_changed_at
  WHERE user_id = p_actor_user_id AND revoked_at IS NULL;
  INSERT INTO public.audit_log (
    actor_admin_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_actor_user_id,
    'ADMIN_PASSWORD_CHANGED',
    'ADMIN_USER',
    p_actor_user_id::text,
    '{}'::jsonb
  );
  RETURN jsonb_build_object('ok', true);
END;
$$;
--> statement-breakpoint

-- SOURCE CHUNK: scripts/supabase-upgrades/0004-admin-data-api/02-admin-users-rpc.sql
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', admin_user.id,
        'username', admin_user.username,
        'role', admin_user.role,
        'active', admin_user.active,
        'lastLoginAt', admin_user.last_login_at,
        'createdAt', admin_user.created_at,
        'activeSessions', (
          SELECT count(*)::integer
          FROM public.admin_sessions AS session
          WHERE session.user_id = admin_user.id
            AND session.revoked_at IS NULL
            AND session.expires_at > now()
        )
      ) ORDER BY admin_user.username
    ),
    '[]'::jsonb
  )
  FROM public.admin_users AS admin_user
$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.admin_mutate_user(
  p_actor_user_id uuid,
  p_action text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_role public.admin_role;
  v_target_id uuid;
  v_target_role public.admin_role;
  v_target_active boolean;
  v_active_admins integer;
  v_username text;
  v_password_hash text;
  v_role public.admin_role;
  v_active boolean;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_actor_user_id IS NULL
     OR p_action NOT IN ('CREATE', 'SET_ROLE', 'SET_ACTIVE', 'RESET_PASSWORD')
     OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END IF;

  LOCK TABLE public.admin_users IN SHARE ROW EXCLUSIVE MODE;
  SELECT role
  INTO v_actor_role
  FROM public.admin_users
  WHERE id = p_actor_user_id AND active = true;
  IF v_actor_role IS DISTINCT FROM 'ADMIN'::public.admin_role THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_ACTOR_INVALID';
  END IF;

  IF p_action = 'CREATE' THEN
    v_username := lower(trim(p_payload ->> 'username'));
    v_password_hash := p_payload ->> 'passwordHash';
    BEGIN
      v_role := (p_payload ->> 'role')::public.admin_role;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
    END;
    IF length(v_username) < 3 OR length(trim(v_password_hash)) < 20 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
    END IF;
    IF EXISTS (SELECT 1 FROM public.admin_users WHERE username = v_username) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_USERNAME_EXISTS';
    END IF;
    INSERT INTO public.admin_users (username, password_hash, role)
    VALUES (v_username, v_password_hash, v_role)
    RETURNING id INTO v_target_id;
    INSERT INTO public.audit_log (
      actor_admin_user_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) VALUES (
      p_actor_user_id,
      'ADMIN_USER_CREATED',
      'ADMIN_USER',
      v_target_id::text,
      jsonb_build_object('username', v_username, 'role', v_role)
    );
    RETURN jsonb_build_object('id', v_target_id);
  END IF;

  BEGIN
    v_target_id := (p_payload ->> 'userId')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
  END;
  SELECT role, active
  INTO v_target_role, v_target_active
  FROM public.admin_users
  WHERE id = v_target_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADMIN_USER_NOT_FOUND';
  END IF;

  SELECT count(*)::integer
  INTO v_active_admins
  FROM public.admin_users
  WHERE role = 'ADMIN' AND active = true;

  IF p_action = 'SET_ROLE' THEN
    BEGIN
      v_role := (p_payload ->> 'role')::public.admin_role;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
    END;
    IF v_target_role = 'ADMIN' AND v_target_active AND v_role <> 'ADMIN'
       AND v_active_admins <= 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LAST_ACTIVE_ADMIN_PROTECTED';
    END IF;
    UPDATE public.admin_users
    SET role = v_role, updated_at = v_now
    WHERE id = v_target_id;
  ELSIF p_action = 'SET_ACTIVE' THEN
    IF jsonb_typeof(p_payload -> 'active') <> 'boolean' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
    END IF;
    v_active := (p_payload ->> 'active')::boolean;
    IF v_target_role = 'ADMIN' AND v_target_active AND NOT v_active
       AND v_active_admins <= 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LAST_ACTIVE_ADMIN_PROTECTED';
    END IF;
    UPDATE public.admin_users
    SET active = v_active, updated_at = v_now
    WHERE id = v_target_id;
    IF NOT v_active THEN
      UPDATE public.admin_sessions
      SET revoked_at = v_now
      WHERE user_id = v_target_id AND revoked_at IS NULL;
    END IF;
  ELSE
    v_password_hash := p_payload ->> 'passwordHash';
    IF length(trim(v_password_hash)) < 20 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ADMIN_DATA_INVALID';
    END IF;
    UPDATE public.admin_users
    SET password_hash = v_password_hash, updated_at = v_now
    WHERE id = v_target_id;
    UPDATE public.admin_sessions
    SET revoked_at = v_now
    WHERE user_id = v_target_id AND revoked_at IS NULL;
  END IF;

  INSERT INTO public.audit_log (
    actor_admin_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_actor_user_id,
    'ADMIN_USER_' || p_action,
    'ADMIN_USER',
    v_target_id::text,
    p_payload - 'passwordHash'
  );
  RETURN jsonb_build_object('id', v_target_id);
END;
$$;
--> statement-breakpoint

-- SOURCE CHUNK: scripts/supabase-upgrades/0004-admin-data-api/03-admin-content-rpc.sql
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
$;
--> statement-breakpoint
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
--> statement-breakpoint

-- SOURCE CHUNK: scripts/supabase-upgrades/0004-admin-data-api/04-admin-publish-reads-rpc.sql
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
$;
--> statement-breakpoint
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
$;
--> statement-breakpoint
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
$;
--> statement-breakpoint
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
$;
--> statement-breakpoint
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
--> statement-breakpoint

-- SOURCE CHUNK: scripts/supabase-upgrades/0004-admin-data-api/05-security-grants.sql
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_module_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentation_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrepreneur_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrepreneur_challenges ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE
  public.admin_users,
  public.admin_sessions,
  public.admin_login_attempts,
  public.audit_log,
  public.config_versions,
  public.questions,
  public.answers,
  public.answer_module_weights,
  public.modules,
  public.modifiers,
  public.engine_rules,
  public.documentation_examples,
  public.recommendations,
  public.module_recommendations,
  public.opportunities,
  public.entrepreneur_stages,
  public.entrepreneur_challenges
FROM anon, authenticated, service_role;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.admin_get_login_context(text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_record_failed_login(text,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_complete_login(uuid,text,timestamptz,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_session(text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_session(text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_user_auth(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_change_password(uuid,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_mutate_user(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_draft() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_publish_draft(uuid,timestamptz,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_latest_published_summary() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_latest_published_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_versions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_audit(text,text,text,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_login_context(text,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_record_failed_login(text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_complete_login(uuid,text,timestamptz,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_resolve_session(text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_session(text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_user_auth(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_change_password(uuid,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_mutate_user(uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_draft() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_publish_draft(uuid,timestamptz,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_latest_published_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_latest_published_snapshot() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_versions() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_audit(text,text,text,timestamptz,timestamptz) TO service_role;
