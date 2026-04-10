-- Migration 040: Financial Summary Cache
-- Menyimpan snapshot hasil kalkulasi keuangan (summary, balance sheet, income
-- statement) per business + periode, sehingga dashboard & laporan tidak perlu
-- recompute dari raw transactions setiap halaman dibuka.
--
-- Cache di-invalidate otomatis via trigger saat ada insert/update/delete pada
-- tabel `transactions`.

CREATE TABLE IF NOT EXISTS financial_summary_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Jenis cache — supaya satu business bisa punya beberapa laporan ter-cache
  -- 'summary'          : calculateFinancialSummary
  -- 'income_statement' : calculateIncomeStatementMetrics + line items
  -- 'balance_sheet'    : calculateBalanceSheet
  -- 'cash_flow'        : calculateCashFlow
  -- 'dashboard'        : KPI bundle untuk /dashboard
  cache_type TEXT NOT NULL CHECK (
    cache_type IN ('summary', 'income_statement', 'balance_sheet', 'cash_flow', 'dashboard')
  ),

  -- Periode kalkulasi (NULL = all-time)
  period_start DATE,
  period_end DATE,

  -- Hasil kalkulasi (struktur tergantung cache_type)
  payload JSONB NOT NULL,

  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  computed_by UUID REFERENCES auth.users(id),

  -- Counter transaksi yang diproses saat cache dibuat (untuk stale detection)
  transaction_count INT NOT NULL DEFAULT 0,

  -- Version monotonik dari `transactions` business ini saat cache dibuat.
  -- Di-bump otomatis oleh trigger setiap kali ada perubahan transaksi.
  cache_version BIGINT NOT NULL DEFAULT 0,

  -- Flag invalidasi eksplisit
  is_stale BOOLEAN NOT NULL DEFAULT FALSE
);

-- Unique key: satu cache aktif per business + type + period
CREATE UNIQUE INDEX IF NOT EXISTS uniq_financial_summary_cache
  ON financial_summary_cache (
    business_id,
    cache_type,
    COALESCE(period_start, '1900-01-01'::date),
    COALESCE(period_end, '9999-12-31'::date)
  );

CREATE INDEX IF NOT EXISTS idx_financial_summary_cache_business
  ON financial_summary_cache (business_id, cache_type);

COMMENT ON TABLE financial_summary_cache IS 'Cache hasil kalkulasi keuangan agar dashboard & laporan tidak recompute setiap load';
COMMENT ON COLUMN financial_summary_cache.cache_version IS 'Versi transaksi bisnis saat cache dibuat — dipakai untuk deteksi stale';
COMMENT ON COLUMN financial_summary_cache.is_stale IS 'Dibangkitkan trigger saat ada perubahan transaksi — consumer cek flag ini sebelum pakai cache';

-- ==========================================
-- Versioning table: monotonic counter per business
-- ==========================================
-- Setiap perubahan transactions (insert/update/delete) akan meng-increment
-- `transaction_version` per business. Cache membandingkan version-nya dengan
-- ini — kalau beda, cache dianggap stale.

CREATE TABLE IF NOT EXISTS business_transaction_versions (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  transaction_version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE business_transaction_versions IS 'Counter monotonik per business yang di-bump tiap perubahan transactions — untuk cache invalidation';

-- Function: bump version + mark cache stale
-- SECURITY DEFINER supaya trigger bisa write meski RLS aktif
CREATE OR REPLACE FUNCTION bump_business_transaction_version()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  v_business_id := COALESCE(NEW.business_id, OLD.business_id);

  IF v_business_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Upsert version counter
  INSERT INTO business_transaction_versions (business_id, transaction_version, updated_at)
  VALUES (v_business_id, 1, now())
  ON CONFLICT (business_id) DO UPDATE
    SET transaction_version = business_transaction_versions.transaction_version + 1,
        updated_at = now();

  -- Tandai semua cache bisnis ini sebagai stale
  UPDATE financial_summary_cache
    SET is_stale = TRUE
    WHERE business_id = v_business_id
      AND is_stale = FALSE;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger: bump version saat transaksi berubah
DROP TRIGGER IF EXISTS trg_bump_transaction_version ON transactions;
CREATE TRIGGER trg_bump_transaction_version
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION bump_business_transaction_version();

-- Helper function: ambil version terkini
CREATE OR REPLACE FUNCTION get_business_transaction_version(p_business_id UUID)
RETURNS BIGINT AS $$
  SELECT COALESCE(transaction_version, 0)
  FROM business_transaction_versions
  WHERE business_id = p_business_id;
$$ LANGUAGE sql STABLE;

-- ==========================================
-- RLS
-- ==========================================

ALTER TABLE financial_summary_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_transaction_versions ENABLE ROW LEVEL SECURITY;

-- financial_summary_cache: user bisnis bisa read, manager bisa write
CREATE POLICY "Users can view financial cache of their businesses"
  ON financial_summary_cache FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

CREATE POLICY "Members can upsert financial cache of their businesses"
  ON financial_summary_cache FOR INSERT
  WITH CHECK (business_id IN (SELECT get_my_business_ids()));

CREATE POLICY "Members can update financial cache of their businesses"
  ON financial_summary_cache FOR UPDATE
  USING (business_id IN (SELECT get_my_business_ids()));

CREATE POLICY "Members can delete financial cache of their businesses"
  ON financial_summary_cache FOR DELETE
  USING (business_id IN (SELECT get_my_business_ids()));

-- business_transaction_versions: read-only untuk user bisnis
CREATE POLICY "Users can view transaction versions of their businesses"
  ON business_transaction_versions FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));
-- Write hanya via trigger (SECURITY DEFINER bypass RLS di plpgsql context).
