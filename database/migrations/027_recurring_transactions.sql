-- Migration: recurring_transactions
-- Tabel untuk menyimpan template transaksi berulang (gaji, sewa, listrik, cicilan, dll.)

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Template fields (mirrors transactions table)
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  amount NUMERIC NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL CHECK (category IN ('EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN')),
  account TEXT DEFAULT '',
  debit_account_id UUID REFERENCES accounts(id),
  credit_account_id UUID REFERENCES accounts(id),
  is_double_entry BOOLEAN DEFAULT false,
  notes TEXT,
  meta JSONB,

  -- Schedule fields
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  interval_value INT NOT NULL DEFAULT 1,       -- setiap N minggu/bulan/tahun
  next_due_date DATE NOT NULL,
  end_date DATE,                                -- NULL = tanpa batas

  -- State
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
  last_generated_date DATE,                     -- terakhir kali draft dibuat
  total_generated INT DEFAULT 0,

  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index utama: query generation (active + due date)
CREATE INDEX idx_recurring_txn_generation
  ON recurring_transactions(business_id, status, next_due_date);

-- Auto-update updated_at
CREATE TRIGGER update_recurring_transactions_updated_at
  BEFORE UPDATE ON recurring_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: user bisa lihat recurring bisnis yang dia ikuti
CREATE POLICY "Users can view recurring transactions of their businesses"
  ON recurring_transactions FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

-- Policy: business_manager/both bisa insert
CREATE POLICY "Managers can insert recurring transactions"
  ON recurring_transactions FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = recurring_transactions.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- Policy: business_manager/both bisa update
CREATE POLICY "Managers can update recurring transactions"
  ON recurring_transactions FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = recurring_transactions.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- Policy: business_manager/both bisa delete
CREATE POLICY "Managers can delete recurring transactions"
  ON recurring_transactions FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = recurring_transactions.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );
