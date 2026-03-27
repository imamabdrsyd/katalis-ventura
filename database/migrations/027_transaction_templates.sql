-- Migration 027: Transaction Templates
-- User bisa simpan pola transaksi yang sering digunakan

CREATE TABLE IF NOT EXISTS transaction_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                          -- Nama template, e.g. "Bayar Gaji Bulanan"
  category TEXT NOT NULL,                      -- EARN | OPEX | VAR | CAPEX | TAX | FIN
  description TEXT,                            -- Default keterangan
  default_amount NUMERIC,                      -- Jumlah default (opsional, user bisa ubah)
  debit_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  credit_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  is_double_entry BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk fetch cepat per bisnis
CREATE INDEX IF NOT EXISTS idx_transaction_templates_business_id
  ON transaction_templates(business_id);

-- RLS
ALTER TABLE transaction_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their business templates"
  ON transaction_templates FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM user_business_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can insert templates"
  ON transaction_templates FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM user_business_roles
      WHERE user_id = auth.uid() AND role IN ('business_manager', 'both')
    )
  );

CREATE POLICY "Managers can delete templates"
  ON transaction_templates FOR DELETE
  USING (
    business_id IN (
      SELECT business_id FROM user_business_roles
      WHERE user_id = auth.uid() AND role IN ('business_manager', 'both')
    )
  );
