-- Migration: Add status column to transactions
-- Status: 'draft' (belum masuk jurnal) atau 'posted' (sudah masuk jurnal/laporan)
-- Semua transaksi existing di-set 'posted' untuk backward compatibility

-- 1. Tambah kolom status
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'posted'
  CHECK (status IN ('draft', 'posted'));

-- 2. Tambah kolom posted_at untuk tracking kapan transaksi di-post
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP WITH TIME ZONE;

-- 3. Set posted_at untuk semua transaksi existing (= created_at)
UPDATE transactions
  SET posted_at = created_at
  WHERE status = 'posted' AND posted_at IS NULL;

-- 4. Index untuk query filter by status (sering dipakai)
CREATE INDEX IF NOT EXISTS idx_transactions_business_status
  ON transactions (business_id, status)
  WHERE deleted_at IS NULL;

-- 5. Update view active_transactions untuk include status
CREATE OR REPLACE VIEW active_transactions AS
  SELECT * FROM transactions WHERE deleted_at IS NULL;

-- Note: Default untuk transaksi baru akan di-handle di application layer
-- (default 'draft' untuk user input manual, bisa 'posted' untuk migrasi/import)
