-- Migration 004: Comprehensive Audit Trail Implementation
-- Adds: updated_by tracking, audit_log table, soft delete for transactions
-- Author: Claude Code
-- Date: 2026-02-02

-- ============================================================================
-- PART 1: AUDIT LOG TABLE
-- ============================================================================

-- Create audit_log table for comprehensive change tracking
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for audit_log (performance optimization)
CREATE INDEX idx_audit_log_record ON audit_log (table_name, record_id, changed_at DESC);
CREATE INDEX idx_audit_log_changed_at ON audit_log (changed_at DESC);
CREATE INDEX idx_audit_log_business ON audit_log ((metadata->>'business_id'), changed_at DESC);
CREATE INDEX idx_audit_log_changed_by ON audit_log (changed_by);

COMMENT ON TABLE audit_log IS 'Universal audit trail for all table changes';
COMMENT ON COLUMN audit_log.old_values IS 'JSONB snapshot of record before change (NULL for INSERT)';
COMMENT ON COLUMN audit_log.new_values IS 'JSONB snapshot of record after change (NULL for DELETE)';
COMMENT ON COLUMN audit_log.metadata IS 'Additional context (e.g., business_id, ip_address)';

-- ============================================================================
-- PART 2: ADD AUDIT COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add updated_by column to transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Add soft delete columns to transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Add updated_by to businesses
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Add updated_by to accounts
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Add updated_by to investor_metrics
ALTER TABLE investor_metrics
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Create partial index for active (non-deleted) transactions (performance boost)
CREATE INDEX IF NOT EXISTS idx_transactions_active
ON transactions (business_id, date DESC)
WHERE deleted_at IS NULL;

-- Create index for deleted transactions (for restore operations)
CREATE INDEX IF NOT EXISTS idx_transactions_deleted
ON transactions (business_id, deleted_at DESC)
WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN transactions.updated_by IS 'User who last updated this transaction';
COMMENT ON COLUMN transactions.deleted_at IS 'Timestamp when transaction was soft-deleted (NULL = active)';
COMMENT ON COLUMN transactions.deleted_by IS 'User who soft-deleted this transaction';

-- ============================================================================
-- PART 3: BACKFILL EXISTING DATA
-- ============================================================================

-- Set updated_by = created_by for existing records (one-time backfill)
UPDATE transactions SET updated_by = created_by WHERE updated_by IS NULL AND created_by IS NOT NULL;
UPDATE businesses SET updated_by = created_by WHERE updated_by IS NULL AND created_by IS NOT NULL;

-- ============================================================================
-- PART 4: TRIGGER FUNCTION FOR AUTO-POPULATING updated_by
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set updated_by if auth.uid() is available (RLS context)
  -- This will be NULL for service role operations, which is acceptable
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_updated_by() IS 'Auto-populate updated_by from auth.uid() on UPDATE';

-- ============================================================================
-- PART 5: ATTACH updated_by TRIGGERS TO TABLES
-- ============================================================================

-- Transactions: Set updated_by before update
DROP TRIGGER IF EXISTS set_transactions_updated_by ON transactions;
CREATE TRIGGER set_transactions_updated_by
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

-- Businesses: Set updated_by before update
DROP TRIGGER IF EXISTS set_businesses_updated_by ON businesses;
CREATE TRIGGER set_businesses_updated_by
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

-- Accounts: Set updated_by before update
DROP TRIGGER IF EXISTS set_accounts_updated_by ON accounts;
CREATE TRIGGER set_accounts_updated_by
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

-- Investor Metrics: Set updated_by before update
DROP TRIGGER IF EXISTS set_investor_metrics_updated_by ON investor_metrics;
CREATE TRIGGER set_investor_metrics_updated_by
  BEFORE UPDATE ON investor_metrics
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

-- ============================================================================
-- PART 6: TRIGGER FUNCTION FOR AUDIT LOGGING
-- ============================================================================

CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
  business_id_value UUID;
BEGIN
  -- Extract business_id from the record (if available)
  -- Different tables have different ways to get business_id
  IF TG_TABLE_NAME = 'transactions' THEN
    business_id_value := COALESCE(NEW.business_id, OLD.business_id);
  ELSIF TG_TABLE_NAME = 'businesses' THEN
    business_id_value := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'accounts' THEN
    business_id_value := COALESCE(NEW.business_id, OLD.business_id);
  ELSIF TG_TABLE_NAME = 'investor_metrics' THEN
    business_id_value := COALESCE(NEW.business_id, OLD.business_id);
  END IF;

  -- Log the change to audit_log table
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values, changed_by, metadata)
    VALUES (
      TG_TABLE_NAME,
      NEW.id,
      'INSERT',
      NULL,
      to_jsonb(NEW),
      auth.uid(),
      jsonb_build_object('business_id', business_id_value)
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if something actually changed (avoid duplicate logs)
    IF OLD IS DISTINCT FROM NEW THEN
      INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values, changed_by, metadata)
      VALUES (
        TG_TABLE_NAME,
        NEW.id,
        'UPDATE',
        to_jsonb(OLD),
        to_jsonb(NEW),
        auth.uid(),
        jsonb_build_object('business_id', business_id_value)
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values, changed_by, metadata)
    VALUES (
      TG_TABLE_NAME,
      OLD.id,
      'DELETE',
      to_jsonb(OLD),
      NULL,
      auth.uid(),
      jsonb_build_object('business_id', business_id_value)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit_trail() IS 'Log all INSERT/UPDATE/DELETE operations to audit_log table';

-- ============================================================================
-- PART 7: ATTACH AUDIT LOGGING TRIGGERS TO TABLES
-- ============================================================================

-- Transactions: Log all changes (after the operation)
DROP TRIGGER IF EXISTS audit_transactions ON transactions;
CREATE TRIGGER audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

-- Businesses: Log all changes
DROP TRIGGER IF EXISTS audit_businesses ON businesses;
CREATE TRIGGER audit_businesses
  AFTER INSERT OR UPDATE OR DELETE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

-- Accounts: Log all changes
DROP TRIGGER IF EXISTS audit_accounts ON accounts;
CREATE TRIGGER audit_accounts
  AFTER INSERT OR UPDATE OR DELETE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

-- Investor Metrics: Log all changes
DROP TRIGGER IF EXISTS audit_investor_metrics ON investor_metrics;
CREATE TRIGGER audit_investor_metrics
  AFTER INSERT OR UPDATE OR DELETE ON investor_metrics
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

-- ============================================================================
-- PART 8: SOFT DELETE FUNCTION FOR TRANSACTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION soft_delete_transaction(transaction_id UUID)
RETURNS void AS $$
BEGIN
  -- Soft delete: Set deleted_at and deleted_by
  UPDATE transactions
  SET
    deleted_at = NOW(),
    deleted_by = auth.uid()
  WHERE id = transaction_id
    AND deleted_at IS NULL; -- Only delete if not already deleted

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or already deleted: %', transaction_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION soft_delete_transaction IS 'Soft delete transaction (sets deleted_at/deleted_by instead of hard DELETE)';

-- ============================================================================
-- PART 9: RESTORE FUNCTION FOR TRANSACTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION restore_transaction(transaction_id UUID)
RETURNS void AS $$
BEGIN
  -- Restore: Clear deleted_at and deleted_by
  UPDATE transactions
  SET
    deleted_at = NULL,
    deleted_by = NULL
  WHERE id = transaction_id
    AND deleted_at IS NOT NULL; -- Only restore if deleted

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or not deleted: %', transaction_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION restore_transaction IS 'Restore soft-deleted transaction (clears deleted_at/deleted_by)';

-- ============================================================================
-- PART 10: ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view audit logs for their businesses
DROP POLICY IF EXISTS "Users can view audit logs for their businesses" ON audit_log;
CREATE POLICY "Users can view audit logs for their businesses"
ON audit_log
FOR SELECT
USING (
  -- Check if user has access to the business
  (metadata->>'business_id')::uuid IN (
    SELECT business_id
    FROM user_business_roles
    WHERE user_id = auth.uid()
  )
);

-- Policy: Only triggers can INSERT audit logs (prevent manual insertions)
-- Note: Triggers run with SECURITY DEFINER, so they bypass RLS
-- This policy effectively prevents any non-trigger insertions
DROP POLICY IF EXISTS "No manual insertions to audit log" ON audit_log;
CREATE POLICY "No manual insertions to audit log"
ON audit_log
FOR INSERT
WITH CHECK (false); -- Always deny direct inserts from users

-- Policy: No one can UPDATE or DELETE audit logs (immutable)
DROP POLICY IF EXISTS "Audit logs are immutable" ON audit_log;
CREATE POLICY "Audit logs are immutable"
ON audit_log
FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "Audit logs cannot be deleted" ON audit_log;
CREATE POLICY "Audit logs cannot be deleted"
ON audit_log
FOR DELETE
USING (false);

-- Update transactions SELECT policy to filter soft-deleted records
-- NOTE: We need to recreate the existing policies to add deleted_at filter

-- Drop existing SELECT policies for transactions
DROP POLICY IF EXISTS "Managers can manage transactions" ON transactions;
DROP POLICY IF EXISTS "Investors can view transactions" ON transactions;

-- Recreate Manager policy (with soft delete filter)
CREATE POLICY "Managers can manage transactions"
ON transactions
FOR ALL
USING (
  business_id IN (
    SELECT business_id
    FROM user_business_roles
    WHERE user_id = auth.uid()
      AND role IN ('business_manager', 'both')
  )
  AND deleted_at IS NULL -- Only show active transactions
);

-- Recreate Investor policy (with soft delete filter)
CREATE POLICY "Investors can view transactions"
ON transactions
FOR SELECT
USING (
  business_id IN (
    SELECT business_id
    FROM user_business_roles
    WHERE user_id = auth.uid()
      AND role IN ('investor', 'both')
  )
  AND deleted_at IS NULL -- Only show active transactions
);

-- Policy: Allow managers to soft delete (UPDATE deleted_at)
DROP POLICY IF EXISTS "Managers can soft delete transactions" ON transactions;
CREATE POLICY "Managers can soft delete transactions"
ON transactions
FOR UPDATE
USING (
  business_id IN (
    SELECT business_id
    FROM user_business_roles
    WHERE user_id = auth.uid()
      AND role IN ('business_manager', 'both')
  )
);

-- ============================================================================
-- PART 11: HELPER VIEWS
-- ============================================================================

-- View: Active transactions (excludes soft-deleted)
CREATE OR REPLACE VIEW active_transactions AS
SELECT * FROM transactions
WHERE deleted_at IS NULL;

COMMENT ON VIEW active_transactions IS 'Transactions that are not soft-deleted';

-- View: Audit trail with user details (for easier querying)
CREATE OR REPLACE VIEW audit_trail_with_users AS
SELECT
  al.*,
  p.full_name AS changed_by_name,
  p.avatar_url AS changed_by_avatar
FROM audit_log al
LEFT JOIN profiles p ON al.changed_by = p.id
ORDER BY al.changed_at DESC;

COMMENT ON VIEW audit_trail_with_users IS 'Audit log with user profile information';

-- View: Deleted transactions (for admin/restore UI)
CREATE OR REPLACE VIEW deleted_transactions AS
SELECT
  t.*,
  p_deleted.full_name AS deleted_by_name
FROM transactions t
LEFT JOIN profiles p_deleted ON t.deleted_by = p_deleted.id
WHERE t.deleted_at IS NOT NULL
ORDER BY t.deleted_at DESC;

COMMENT ON VIEW deleted_transactions IS 'Soft-deleted transactions with user who deleted them';

-- ============================================================================
-- PART 12: GRANT PERMISSIONS
-- ============================================================================

-- Grant SELECT on audit_log to authenticated users (RLS controls actual access)
GRANT SELECT ON audit_log TO authenticated;

-- Grant SELECT on helper views
GRANT SELECT ON active_transactions TO authenticated;
GRANT SELECT ON audit_trail_with_users TO authenticated;
GRANT SELECT ON deleted_transactions TO authenticated;

-- Grant EXECUTE on soft delete/restore functions
GRANT EXECUTE ON FUNCTION soft_delete_transaction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_transaction(UUID) TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 004 completed successfully!';
  RAISE NOTICE '📋 Audit log table created';
  RAISE NOTICE '📝 Audit columns added to 4 tables (transactions, businesses, accounts, investor_metrics)';
  RAISE NOTICE '🔄 Triggers created for auto-populating updated_by';
  RAISE NOTICE '📊 Triggers created for audit logging';
  RAISE NOTICE '🔒 RLS policies created for audit_log';
  RAISE NOTICE '🗑️ Soft delete enabled for transactions';
  RAISE NOTICE '🔍 Helper views created';
  RAISE NOTICE '✨ Ready to track all changes!';
END $$;
