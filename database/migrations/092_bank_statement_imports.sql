-- Migration 092: Bank Statement Imports
-- Mendukung import mutasi bank (CSV/XLSX/PDF) untuk rekonsiliasi yang lebih cepat.
--
-- 2 tabel:
--   1. bank_statement_imports  — satu baris per file mutasi yang di-upload
--   2. bank_transactions       — baris mutasi yang sudah di-parse
--
-- Flow:
--   user upload mutasi BCA April 2026 → parse → preview → commit
--   → bank_transactions terisi → bisa di-match ke transactions (Axion ledger)

-- =========================================================================
-- 1. bank_statement_imports — header per file
-- =========================================================================
CREATE TABLE IF NOT EXISTS bank_statement_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),

  -- Sumber file
  source TEXT NOT NULL CHECK (source IN ('csv','xlsx','pdf_ocr','image_ocr','manual')),
  bank_code TEXT,                          -- 'BCA' | 'MANDIRI' | 'BRI' | 'BNI' | 'GENERIC'

  -- Periode dari header file
  period_start DATE,
  period_end DATE,

  -- Saldo dari summary file (untuk validasi rekonsiliasi)
  opening_balance NUMERIC,
  closing_balance NUMERIC,
  total_credit NUMERIC,                    -- MUTASI CR
  total_debit NUMERIC,                     -- MUTASI DB

  -- File asli (untuk audit/debugging)
  raw_file_name TEXT,
  raw_file_hash TEXT,                      -- SHA-256 (link ke ocr_scan_cache kalau PDF/image)
  raw_text TEXT,                           -- snapshot teks OCR / CSV asli

  -- Statistik parsing
  total_rows INTEGER DEFAULT 0,            -- total baris terdeteksi
  matched_rows INTEGER DEFAULT 0,          -- baris yang sudah ter-match
  status TEXT NOT NULL DEFAULT 'parsed'
    CHECK (status IN ('parsed','reviewed','committed','failed','discarded')),
  parse_error TEXT,

  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  committed_at TIMESTAMPTZ,

  CONSTRAINT bsi_period_nonneg CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_bsi_business_date ON bank_statement_imports(business_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_bsi_status ON bank_statement_imports(business_id, status);

COMMENT ON TABLE bank_statement_imports IS 'Header file mutasi bank yang di-import oleh user';
COMMENT ON COLUMN bank_statement_imports.raw_file_hash IS 'SHA-256 file; link ke ocr_scan_cache untuk re-parse';

-- =========================================================================
-- 2. bank_transactions — baris mutasi
-- =========================================================================
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,               -- denorm untuk RLS speed
  account_id UUID NOT NULL REFERENCES accounts(id),
  import_id UUID REFERENCES bank_statement_imports(id) ON DELETE CASCADE,

  -- Data dari bank
  posted_at DATE NOT NULL,
  value_date DATE,                         -- tanggal value (kalau beda dari posting)
  description TEXT,                        -- keterangan utama (mis. "TRSF E-BANKING DB")
  amount NUMERIC NOT NULL,                 -- (+) credit/masuk, (-) debit/keluar
  running_balance NUMERIC,                 -- saldo setelah transaksi (kalau ada)
  reference_code TEXT,                     -- VA / berita transfer / FTSCY code
  counterparty_name TEXT,                  -- nama lawan transaksi (mis. "NENENG NUR AZIZAH")
  raw_row JSONB,                            -- baris asli untuk debugging

  -- Status matching ke transactions (Axion ledger)
  match_status TEXT NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN ('unmatched','auto_matched','manual_matched','ignored','created_new')),
  matched_transaction_id UUID REFERENCES transactions(id),
  match_confidence NUMERIC CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1)),
  matched_by UUID REFERENCES auth.users(id),
  matched_at TIMESTAMPTZ,

  -- Dedup di level akun: hash(posted_at + amount + description) supaya re-upload tidak duplikat
  dedup_hash TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, dedup_hash)
);

CREATE INDEX IF NOT EXISTS idx_bt_account_date ON bank_transactions(account_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_bt_business_unmatched
  ON bank_transactions(business_id, match_status)
  WHERE match_status = 'unmatched';
CREATE INDEX IF NOT EXISTS idx_bt_import ON bank_transactions(import_id);
CREATE INDEX IF NOT EXISTS idx_bt_matched_tx ON bank_transactions(matched_transaction_id) WHERE matched_transaction_id IS NOT NULL;

COMMENT ON TABLE bank_transactions IS 'Mutasi bank per baris, hasil parse file import';
COMMENT ON COLUMN bank_transactions.amount IS 'Positif = uang masuk (CR), negatif = uang keluar (DB)';
COMMENT ON COLUMN bank_transactions.dedup_hash IS 'Hash unik per akun untuk cegah duplicate import';

-- =========================================================================
-- 3. RLS — mengikuti pola migration 040
-- =========================================================================
ALTER TABLE bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- bank_statement_imports
CREATE POLICY "Users can view bank statement imports of their businesses"
  ON bank_statement_imports FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

CREATE POLICY "Managers can insert bank statement imports"
  ON bank_statement_imports FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = bank_statement_imports.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can update bank statement imports"
  ON bank_statement_imports FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = bank_statement_imports.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can delete bank statement imports"
  ON bank_statement_imports FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = bank_statement_imports.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- bank_transactions
CREATE POLICY "Users can view bank transactions of their businesses"
  ON bank_transactions FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

CREATE POLICY "Managers can insert bank transactions"
  ON bank_transactions FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = bank_transactions.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can update bank transactions"
  ON bank_transactions FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = bank_transactions.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can delete bank transactions"
  ON bank_transactions FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = bank_transactions.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );
