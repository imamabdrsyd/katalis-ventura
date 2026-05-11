-- Migration 069: Transactional RPC for using invite codes
-- Replaces the client-side increment + insert + manual rollback pattern in
-- src/lib/api/inviteCodes.ts (useInviteCode), which was vulnerable to a race
-- where two concurrent successful joins could both pass the optimistic check
-- and the rollback path could overwrite a concurrent increment.

CREATE OR REPLACE FUNCTION use_invite_code(p_code TEXT, p_user_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  business_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite invite_codes%ROWTYPE;
BEGIN
  -- Lock the row to serialize concurrent redemptions of the same code.
  SELECT * INTO v_invite
  FROM invite_codes
  WHERE code = UPPER(p_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Kode undangan tidak valid'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF NOT v_invite.is_active THEN
    RETURN QUERY SELECT FALSE, 'Kode undangan sudah tidak aktif'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, 'Kode undangan sudah kadaluarsa'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_invite.current_uses >= v_invite.max_uses THEN
    RETURN QUERY SELECT FALSE, 'Kode undangan sudah mencapai batas penggunaan'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_business_roles
    WHERE user_id = p_user_id AND user_business_roles.business_id = v_invite.business_id
  ) THEN
    RETURN QUERY SELECT FALSE, 'Anda sudah tergabung di bisnis ini'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Both writes happen in the same transaction: if the insert fails, the
  -- increment is rolled back automatically by Postgres.
  UPDATE invite_codes
  SET current_uses = current_uses + 1
  WHERE id = v_invite.id;

  INSERT INTO user_business_roles (user_id, business_id, role, invited_by)
  VALUES (p_user_id, v_invite.business_id, v_invite.role, v_invite.created_by);

  RETURN QUERY SELECT TRUE, NULL::TEXT, v_invite.business_id;
END;
$$;

GRANT EXECUTE ON FUNCTION use_invite_code(TEXT, UUID) TO authenticated;
