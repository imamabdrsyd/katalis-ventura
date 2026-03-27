-- ============================================================
-- 028_multi_line_journal_entries.sql
-- Adds journal_lines table for compound (multi-line) journal entries.
-- A multi-line transaction can have N debit lines and M credit lines
-- as long as total debits = total credits.
-- ============================================================

-- 1. Add is_multi_line flag to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS is_multi_line BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create journal_lines table
CREATE TABLE IF NOT EXISTS journal_lines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id     UUID NOT NULL REFERENCES accounts(id),
  debit_amount   NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
  credit_amount  NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  description    TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Exactly one side must be non-zero (each line is either a debit OR a credit)
  CONSTRAINT journal_line_one_side_nonzero CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR
    (credit_amount > 0 AND debit_amount = 0)
  )
);

-- 3. Index for fast lookup by transaction
CREATE INDEX IF NOT EXISTS idx_journal_lines_transaction_id
  ON journal_lines(transaction_id);

-- 4. Enable RLS
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

-- 5. SELECT: any member of the business can read journal_lines
CREATE POLICY "journal_lines_select" ON journal_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM transactions t
        JOIN user_business_roles ubr ON ubr.business_id = t.business_id
       WHERE t.id = journal_lines.transaction_id
         AND ubr.user_id = auth.uid()
    )
  );

-- 6. INSERT: only business managers (and superadmin via service role)
CREATE POLICY "journal_lines_insert" ON journal_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
        FROM transactions t
        JOIN user_business_roles ubr ON ubr.business_id = t.business_id
       WHERE t.id = journal_lines.transaction_id
         AND ubr.user_id = auth.uid()
         AND ubr.role IN ('business_manager', 'both')
    )
  );

-- 7. UPDATE: only business managers
CREATE POLICY "journal_lines_update" ON journal_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
        FROM transactions t
        JOIN user_business_roles ubr ON ubr.business_id = t.business_id
       WHERE t.id = journal_lines.transaction_id
         AND ubr.user_id = auth.uid()
         AND ubr.role IN ('business_manager', 'both')
    )
  );

-- 8. DELETE: only business managers
CREATE POLICY "journal_lines_delete" ON journal_lines
  FOR DELETE USING (
    EXISTS (
      SELECT 1
        FROM transactions t
        JOIN user_business_roles ubr ON ubr.business_id = t.business_id
       WHERE t.id = journal_lines.transaction_id
         AND ubr.user_id = auth.uid()
         AND ubr.role IN ('business_manager', 'both')
    )
  );
