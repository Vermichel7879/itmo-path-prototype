BEGIN;

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
$$;

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

COMMIT;

SELECT count(*)::integer AS user_rpc_functions
FROM pg_proc AS procedure
JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname = 'public'
  AND procedure.proname = ANY (ARRAY['admin_list_users', 'admin_mutate_user']);
