-- Migration 038: Import Batches
-- Menyimpan riwayat bulk import (Excel/CSV) sehingga setiap batch transaksi
-- hasil import bisa ditelusuri (siapa, kapan, file apa, berapa baris) dan
-- memungkinkan rollback per batch.

CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Metadata file sumber
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,

  -- Mode import: 'smart' (auto-resolve) atau 'full' (manual mapping)
  import_mode TEXT NOT NULL DEFAULT 'smart' CHECK (import_mode IN ('smart', 'full')),

  -- Statistik
  total_rows INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,

  -- Status import
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'partial', 'failed', 'rolled_back')),

  -- Detail error (array of {row, column, message}) jika ada kegagalan
  errors JSONB DEFAULT '[]'::jsonb,

  -- Catatan tambahan (opsional, untuk user input)
  notes TEXT,

  -- Audit
  imported_by UUID NOT NULL REFERENCES auth.users(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rolled_back_at TIMESTAMPTZ,
  rolled_back_by UUID REFERENCES auth.users(id)
);

-- Tambah import_batch_id ke transactions untuk linkage
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;

-- Index untuk query batch history per business
CREATE INDEX IF NOT EXISTS idx_import_batches_business_date
  ON import_batches (business_id, imported_at DESC);

-- Index untuk lookup transaksi per batch (rollback, detail)
CREATE INDEX IF NOT EXISTS idx_transactions_import_batch
  ON transactions (import_batch_id)
  WHERE import_batch_id IS NOT NULL;

COMMENT ON TABLE import_batches IS 'Riwayat bulk import transaksi dari Excel/CSV per business';
COMMENT ON COLUMN import_batches.import_mode IS 'smart = auto-resolve category/account, full = manual mapping';
COMMENT ON COLUMN import_batches.status IS 'pending → success/partial/failed; rolled_back setelah dibatalkan';
COMMENT ON COLUMN import_batches.errors IS 'Array of {row, column, message} saat validasi/insert gagal';
COMMENT ON COLUMN transactions.import_batch_id IS 'Link ke import_batches saat transaksi dibuat via bulk import';

-- Auto-update statistik saat transaksi batch dihapus (soft delete via rollback)
-- Tidak perlu trigger — update statistik dilakukan di application layer saat rollback.

-- RLS
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- Policy: user bisa lihat batch bisnis yang dia ikuti
CREATE POLICY "Users can view import batches of their businesses"
  ON import_batches FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

-- Policy: business_manager/both bisa insert
CREATE POLICY "Managers can insert import batches"
  ON import_batches FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = import_batches.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- Policy: business_manager/both bisa update (untuk status & rollback)
CREATE POLICY "Managers can update import batches"
  ON import_batches FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = import_batches.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- Policy: business_manager/both bisa delete (hard delete batch record)
CREATE POLICY "Managers can delete import batches"
  ON import_batches FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = import_batches.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );
