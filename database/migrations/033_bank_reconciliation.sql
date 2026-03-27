-- Migration 033: Bank Reconciliation fields
-- Adds reconciliation tracking to transactions

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES auth.users(id) DEFAULT NULL;

-- Index for quickly filtering unreconciled transactions
CREATE INDEX IF NOT EXISTS idx_transactions_reconciled
  ON transactions (business_id, is_reconciled)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN transactions.is_reconciled IS 'Apakah transaksi sudah dicocokkan dengan mutasi bank';
COMMENT ON COLUMN transactions.reconciled_at IS 'Timestamp saat transaksi di-reconcile';
COMMENT ON COLUMN transactions.reconciled_by IS 'User yang melakukan reconciliation';
