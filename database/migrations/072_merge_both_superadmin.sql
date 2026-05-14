-- Migration: Merge legacy "both" role into canonical "superadmin"
-- Super Admin access is membership-scoped: the user must be a member/creator of
-- a business to manage it, so the role is visible in the member list.

UPDATE user_business_roles
SET role = 'superadmin'
WHERE role = 'both';

UPDATE profiles
SET default_role = 'superadmin'
WHERE default_role = 'both';

UPDATE user_business_roles
SET role = 'superadmin'
WHERE user_id IN (
  SELECT id FROM profiles WHERE default_role = 'superadmin'
);

INSERT INTO user_business_roles (user_id, business_id, role)
SELECT
  b.created_by,
  b.id,
  CASE
    WHEN p.default_role = 'superadmin' THEN 'superadmin'
    ELSE 'business_manager'
  END
FROM businesses b
LEFT JOIN profiles p ON p.id = b.created_by
WHERE b.created_by IS NOT NULL
ON CONFLICT (user_id, business_id) DO NOTHING;

ALTER TABLE user_business_roles
  DROP CONSTRAINT IF EXISTS user_business_roles_role_check;

ALTER TABLE user_business_roles
  ADD CONSTRAINT user_business_roles_role_check
  CHECK (role IN ('business_manager', 'investor', 'superadmin'));

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_default_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_default_role_check
  CHECK (default_role IN ('business_manager', 'investor', 'superadmin'));

CREATE OR REPLACE FUNCTION is_business_manager(bid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_business_roles
    WHERE user_id = auth.uid()
    AND business_id = bid
    AND role IN ('business_manager', 'superadmin')
  )
  OR EXISTS (
    SELECT 1 FROM businesses
    WHERE id = bid AND created_by = auth.uid()
  );
$$;

-- Remove old profile-only global superadmin policies. Access now flows through
-- membership/creator policies plus manager policies that include superadmin.
DROP POLICY IF EXISTS "superadmin_read_all_businesses" ON businesses;
DROP POLICY IF EXISTS "superadmin_update_all_businesses" ON businesses;
DROP POLICY IF EXISTS "superadmin_read_all_transactions" ON transactions;
DROP POLICY IF EXISTS "superadmin_manage_all_transactions" ON transactions;
DROP POLICY IF EXISTS "superadmin_read_all_accounts" ON accounts;
DROP POLICY IF EXISTS "superadmin_manage_all_accounts" ON accounts;
DROP POLICY IF EXISTS "superadmin_manage_all_budgets" ON budgets;
DROP POLICY IF EXISTS "superadmin_manage_all_budget_lines" ON budget_lines;

DROP POLICY IF EXISTS "superadmin_members_can_update_joined_businesses" ON businesses;
CREATE POLICY "superadmin_members_can_update_joined_businesses"
  ON businesses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = businesses.id
        AND role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = businesses.id
        AND role = 'superadmin'
    )
  );

DROP POLICY IF EXISTS "Managers can manage transactions" ON transactions;
DROP POLICY IF EXISTS "Investors can view transactions" ON transactions;
DROP POLICY IF EXISTS "Managers can soft delete transactions" ON transactions;

CREATE POLICY "Managers can manage transactions"
ON transactions
FOR ALL
USING (
  business_id IN (
    SELECT business_id FROM user_business_roles
    WHERE user_id = auth.uid()
      AND role IN ('business_manager', 'superadmin')
  )
  AND deleted_at IS NULL
);

CREATE POLICY "Investors can view transactions"
ON transactions
FOR SELECT
USING (
  business_id IN (
    SELECT business_id FROM user_business_roles
    WHERE user_id = auth.uid()
      AND role IN ('investor', 'superadmin')
  )
  AND deleted_at IS NULL
);

CREATE POLICY "Managers can soft delete transactions"
ON transactions
FOR UPDATE
USING (
  business_id IN (
    SELECT business_id FROM user_business_roles
    WHERE user_id = auth.uid()
      AND role IN ('business_manager', 'superadmin')
  )
);

DROP POLICY IF EXISTS "journal_lines_insert" ON journal_lines;
DROP POLICY IF EXISTS "journal_lines_update" ON journal_lines;
DROP POLICY IF EXISTS "journal_lines_delete" ON journal_lines;

CREATE POLICY "journal_lines_insert" ON journal_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM transactions t
      JOIN user_business_roles ubr ON ubr.business_id = t.business_id
      WHERE t.id = journal_lines.transaction_id
        AND ubr.user_id = auth.uid()
        AND ubr.role IN ('business_manager', 'superadmin')
    )
  );

CREATE POLICY "journal_lines_update" ON journal_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM transactions t
      JOIN user_business_roles ubr ON ubr.business_id = t.business_id
      WHERE t.id = journal_lines.transaction_id
        AND ubr.user_id = auth.uid()
        AND ubr.role IN ('business_manager', 'superadmin')
    )
  );

CREATE POLICY "journal_lines_delete" ON journal_lines
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM transactions t
      JOIN user_business_roles ubr ON ubr.business_id = t.business_id
      WHERE t.id = journal_lines.transaction_id
        AND ubr.user_id = auth.uid()
        AND ubr.role IN ('business_manager', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Managers can create invoices" ON invoices;
DROP POLICY IF EXISTS "Managers can update invoices" ON invoices;
DROP POLICY IF EXISTS "Managers can delete invoices" ON invoices;
DROP POLICY IF EXISTS "Managers can manage invoice line items" ON invoice_line_items;

CREATE POLICY "Managers can create invoices"
  ON invoices FOR INSERT
  WITH CHECK (is_business_manager(business_id));

CREATE POLICY "Managers can update invoices"
  ON invoices FOR UPDATE
  USING (is_business_manager(business_id));

CREATE POLICY "Managers can delete invoices"
  ON invoices FOR DELETE
  USING (is_business_manager(business_id));

CREATE POLICY "Managers can manage invoice line items"
  ON invoice_line_items FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE is_business_manager(business_id)
    )
  );

DROP POLICY IF EXISTS "Managers can create budgets" ON budgets;
DROP POLICY IF EXISTS "Managers can update budgets" ON budgets;
DROP POLICY IF EXISTS "Managers can delete draft budgets" ON budgets;
DROP POLICY IF EXISTS "Managers can manage budget lines" ON budget_lines;

CREATE POLICY "Managers can create budgets"
  ON budgets FOR INSERT
  WITH CHECK (is_business_manager(business_id));

CREATE POLICY "Managers can update budgets"
  ON budgets FOR UPDATE
  USING (status != 'locked' AND is_business_manager(business_id));

CREATE POLICY "Managers can delete draft budgets"
  ON budgets FOR DELETE
  USING (status = 'draft' AND is_business_manager(business_id));

CREATE POLICY "Managers can manage budget lines"
  ON budget_lines FOR ALL
  USING (
    budget_id IN (
      SELECT id FROM budgets
      WHERE status != 'locked'
        AND is_business_manager(business_id)
    )
  );

DROP POLICY IF EXISTS "Managers can insert contacts" ON business_contacts;
DROP POLICY IF EXISTS "Managers can update contacts" ON business_contacts;
DROP POLICY IF EXISTS "Managers can delete contacts" ON business_contacts;

CREATE POLICY "Managers can insert contacts"
  ON business_contacts FOR INSERT
  WITH CHECK (is_business_manager(business_id));

CREATE POLICY "Managers can update contacts"
  ON business_contacts FOR UPDATE
  USING (is_business_manager(business_id));

CREATE POLICY "Managers can delete contacts"
  ON business_contacts FOR DELETE
  USING (is_business_manager(business_id));

DROP POLICY IF EXISTS "Managers can insert recurring transactions" ON recurring_transactions;
DROP POLICY IF EXISTS "Managers can update recurring transactions" ON recurring_transactions;
DROP POLICY IF EXISTS "Managers can delete recurring transactions" ON recurring_transactions;

CREATE POLICY "Managers can insert recurring transactions"
  ON recurring_transactions FOR INSERT
  WITH CHECK (is_business_manager(business_id));

CREATE POLICY "Managers can update recurring transactions"
  ON recurring_transactions FOR UPDATE
  USING (is_business_manager(business_id));

CREATE POLICY "Managers can delete recurring transactions"
  ON recurring_transactions FOR DELETE
  USING (is_business_manager(business_id));

DROP POLICY IF EXISTS "Managers can insert templates" ON transaction_templates;
DROP POLICY IF EXISTS "Managers can delete templates" ON transaction_templates;

CREATE POLICY "Managers can insert templates"
  ON transaction_templates FOR INSERT
  WITH CHECK (is_business_manager(business_id));

CREATE POLICY "Managers can delete templates"
  ON transaction_templates FOR DELETE
  USING (is_business_manager(business_id));

DROP POLICY IF EXISTS "pricing_rules_manager_all" ON business_pricing_rules;

CREATE POLICY "pricing_rules_manager_all" ON business_pricing_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM business_omni_channels oc
      WHERE oc.id = business_pricing_rules.omni_channel_id
        AND is_business_manager(oc.business_id)
    )
  );

DROP POLICY IF EXISTS "Business creator can view requests" ON business_join_requests;
DROP POLICY IF EXISTS "Business creator can update requests" ON business_join_requests;
DROP POLICY IF EXISTS "Business managers can view requests" ON business_join_requests;
DROP POLICY IF EXISTS "Business managers can update requests" ON business_join_requests;

CREATE POLICY "Business managers can view requests"
  ON business_join_requests FOR SELECT
  USING (is_business_manager(business_id));

CREATE POLICY "Business managers can update requests"
  ON business_join_requests FOR UPDATE
  USING (is_business_manager(business_id));

DROP POLICY IF EXISTS "ecommerce_connections_select" ON business_ecommerce_connections;
DROP POLICY IF EXISTS "ecommerce_connections_manage" ON business_ecommerce_connections;
DROP POLICY IF EXISTS "ecommerce_sync_logs_select" ON ecommerce_sync_logs;
DROP POLICY IF EXISTS "ecommerce_sync_logs_insert" ON ecommerce_sync_logs;

CREATE POLICY "ecommerce_connections_select" ON business_ecommerce_connections
  FOR SELECT
  USING (is_business_manager(business_id));

CREATE POLICY "ecommerce_connections_manage" ON business_ecommerce_connections
  FOR ALL
  USING (is_business_manager(business_id))
  WITH CHECK (is_business_manager(business_id));

CREATE POLICY "ecommerce_sync_logs_select" ON ecommerce_sync_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM business_ecommerce_connections c
      WHERE c.id = ecommerce_sync_logs.connection_id
        AND is_business_manager(c.business_id)
    )
  );

CREATE POLICY "ecommerce_sync_logs_insert" ON ecommerce_sync_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM business_ecommerce_connections c
      WHERE c.id = ecommerce_sync_logs.connection_id
        AND is_business_manager(c.business_id)
    )
  );

DROP POLICY IF EXISTS "Managers can insert import batches" ON import_batches;
DROP POLICY IF EXISTS "Managers can update import batches" ON import_batches;
DROP POLICY IF EXISTS "Managers can delete import batches" ON import_batches;

CREATE POLICY "Managers can insert import batches"
  ON import_batches FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND is_business_manager(business_id)
  );

CREATE POLICY "Managers can update import batches"
  ON import_batches FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND is_business_manager(business_id)
  );

CREATE POLICY "Managers can delete import batches"
  ON import_batches FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND is_business_manager(business_id)
  );

DROP POLICY IF EXISTS "Managers can insert reconciliation sessions" ON reconciliation_sessions;
DROP POLICY IF EXISTS "Managers can update reconciliation sessions" ON reconciliation_sessions;
DROP POLICY IF EXISTS "Managers can delete reconciliation sessions" ON reconciliation_sessions;
DROP POLICY IF EXISTS "Managers can insert match rows" ON reconciliation_session_matches;
DROP POLICY IF EXISTS "Managers can delete match rows" ON reconciliation_session_matches;

CREATE POLICY "Managers can insert reconciliation sessions"
  ON reconciliation_sessions FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND is_business_manager(business_id)
  );

CREATE POLICY "Managers can update reconciliation sessions"
  ON reconciliation_sessions FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND is_business_manager(business_id)
  );

CREATE POLICY "Managers can delete reconciliation sessions"
  ON reconciliation_sessions FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND is_business_manager(business_id)
  );

CREATE POLICY "Managers can insert match rows"
  ON reconciliation_session_matches FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT rs.id FROM reconciliation_sessions rs
      WHERE rs.business_id IN (SELECT get_my_business_ids())
        AND is_business_manager(rs.business_id)
    )
  );

CREATE POLICY "Managers can delete match rows"
  ON reconciliation_session_matches FOR DELETE
  USING (
    session_id IN (
      SELECT rs.id FROM reconciliation_sessions rs
      WHERE rs.business_id IN (SELECT get_my_business_ids())
        AND is_business_manager(rs.business_id)
    )
  );

DROP POLICY IF EXISTS "Business managers can delete attachments" ON storage.objects;

CREATE POLICY "Business managers can delete attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT b.id::text FROM businesses b
    WHERE is_business_manager(b.id)
  )
);

CREATE OR REPLACE FUNCTION replace_journal_lines(
  p_transaction_id UUID,
  p_lines JSONB
)
RETURNS VOID AS $$
DECLARE
  v_line JSONB;
  v_sort_order INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM transactions t
     WHERE t.id = p_transaction_id
       AND is_business_manager(t.business_id)
  ) THEN
    RAISE EXCEPTION 'Tidak berhak mengubah jurnal transaksi ini';
  END IF;

  DELETE FROM journal_lines WHERE transaction_id = p_transaction_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO journal_lines (
      transaction_id,
      account_id,
      debit_amount,
      credit_amount,
      description,
      sort_order
    ) VALUES (
      p_transaction_id,
      (v_line->>'account_id')::UUID,
      COALESCE((v_line->>'debit_amount')::NUMERIC, 0),
      COALESCE((v_line->>'credit_amount')::NUMERIC, 0),
      NULLIF(v_line->>'description', ''),
      COALESCE((v_line->>'sort_order')::INTEGER, v_sort_order)
    );
    v_sort_order := v_sort_order + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION replace_journal_lines(UUID, JSONB) TO authenticated;

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
  v_role TEXT;
BEGIN
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

  SELECT
    CASE
      WHEN default_role = 'superadmin' THEN 'superadmin'
      ELSE v_invite.role
    END
  INTO v_role
  FROM profiles
  WHERE id = p_user_id;

  UPDATE invite_codes
  SET current_uses = current_uses + 1
  WHERE id = v_invite.id;

  INSERT INTO user_business_roles (user_id, business_id, role, invited_by)
  VALUES (p_user_id, v_invite.business_id, COALESCE(v_role, v_invite.role), v_invite.created_by);

  RETURN QUERY SELECT TRUE, NULL::TEXT, v_invite.business_id;
END;
$$;

GRANT EXECUTE ON FUNCTION use_invite_code(TEXT, UUID) TO authenticated;
