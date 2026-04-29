-- Migration: Fix superadmin RLS on business_contacts, recurring_transactions, reconciliation_sessions, import_batches
-- Masalah: policy INSERT/UPDATE/DELETE di tabel-tabel tsb mengecek role di user_business_roles,
-- tapi superadmin tidak punya row di user_business_roles per bisnis —
-- superadmin diidentifikasi lewat profiles.default_role = 'superadmin'.

-- ============================================
-- business_contacts
-- ============================================
DROP POLICY IF EXISTS "Managers can insert contacts" ON business_contacts;
DROP POLICY IF EXISTS "Managers can update contacts" ON business_contacts;
DROP POLICY IF EXISTS "Managers can delete contacts" ON business_contacts;

CREATE POLICY "Managers can insert contacts"
  ON business_contacts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.default_role = 'superadmin'
    )
    OR (
      business_id IN (SELECT get_my_business_ids())
      AND EXISTS (
        SELECT 1 FROM user_business_roles
        WHERE user_id = auth.uid()
          AND business_id = business_contacts.business_id
          AND role IN ('business_manager', 'both')
      )
    )
  );

CREATE POLICY "Managers can update contacts"
  ON business_contacts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.default_role = 'superadmin'
    )
    OR (
      business_id IN (SELECT get_my_business_ids())
      AND EXISTS (
        SELECT 1 FROM user_business_roles
        WHERE user_id = auth.uid()
          AND business_id = business_contacts.business_id
          AND role IN ('business_manager', 'both')
      )
    )
  );

CREATE POLICY "Managers can delete contacts"
  ON business_contacts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.default_role = 'superadmin'
    )
    OR (
      business_id IN (SELECT get_my_business_ids())
      AND EXISTS (
        SELECT 1 FROM user_business_roles
        WHERE user_id = auth.uid()
          AND business_id = business_contacts.business_id
          AND role IN ('business_manager', 'both')
      )
    )
  );

-- ============================================
-- recurring_transactions (migration 028)
-- ============================================
DROP POLICY IF EXISTS "Managers can insert recurring transactions" ON recurring_transactions;
DROP POLICY IF EXISTS "Managers can update recurring transactions" ON recurring_transactions;
DROP POLICY IF EXISTS "Managers can delete recurring transactions" ON recurring_transactions;

CREATE POLICY "Managers can insert recurring transactions"
  ON recurring_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.default_role = 'superadmin'
    )
    OR (
      business_id IN (SELECT get_my_business_ids())
      AND EXISTS (
        SELECT 1 FROM user_business_roles
        WHERE user_id = auth.uid()
          AND business_id = recurring_transactions.business_id
          AND role IN ('business_manager', 'both')
      )
    )
  );

CREATE POLICY "Managers can update recurring transactions"
  ON recurring_transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.default_role = 'superadmin'
    )
    OR (
      business_id IN (SELECT get_my_business_ids())
      AND EXISTS (
        SELECT 1 FROM user_business_roles
        WHERE user_id = auth.uid()
          AND business_id = recurring_transactions.business_id
          AND role IN ('business_manager', 'both')
      )
    )
  );

CREATE POLICY "Managers can delete recurring transactions"
  ON recurring_transactions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.default_role = 'superadmin'
    )
    OR (
      business_id IN (SELECT get_my_business_ids())
      AND EXISTS (
        SELECT 1 FROM user_business_roles
        WHERE user_id = auth.uid()
          AND business_id = recurring_transactions.business_id
          AND role IN ('business_manager', 'both')
      )
    )
  );
