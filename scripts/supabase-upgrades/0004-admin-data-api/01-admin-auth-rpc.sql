BEGIN;

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
$$;

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
$$;

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
$$;

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
$$;

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
$$;

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
$$;

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

COMMIT;

SELECT count(*)::integer AS auth_rpc_functions
FROM pg_proc AS procedure
JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname = 'public'
  AND procedure.proname = ANY (ARRAY[
    'admin_get_login_context',
    'admin_record_failed_login',
    'admin_complete_login',
    'admin_resolve_session',
    'admin_revoke_session',
    'admin_get_user_auth',
    'admin_change_password'
  ]);
