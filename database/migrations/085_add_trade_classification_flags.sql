-- Migration 085: Tambah flag is_trade_receivable & is_operating_payable ke accounts
--
-- Tujuan: Mengganti heuristic keyword matching ("piutang usaha", "hutang usaha",
-- "payable", "accrued") di classifyCashFlow() dan beberapa helper lain dengan
-- flag boolean eksplisit. Ini menyelesaikan audit finding LOW: bisnis dengan
-- nama akun non-standar (mis. "Tagihan Pelanggan", "Outstanding Bills") akan
-- ter-misklasifikasi sebagai Investing/Financing di Cash Flow Statement.
--
-- Pola mirip migration 071 (is_cash_equivalent) dan 060 (is_dividend).
--
-- Strategi: flag-first di kode, fallback ke heuristic untuk data lama yang
-- belum sempat di-backfill (mis. akun yang user buat dengan nama unik).

-- 1) Tambah kolom dengan default FALSE — aman untuk semua row existing.
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS is_trade_receivable BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS is_operating_payable BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN accounts.is_trade_receivable IS
  'TRUE jika akun ini adalah piutang usaha (trade receivable). Cash flow dari akun ini diklasifikasikan sebagai Operating Activity per IAS 7.14. Talangan/advance dikecualikan (tetap Financing).';

COMMENT ON COLUMN accounts.is_operating_payable IS
  'TRUE jika akun ini adalah hutang operasional (trade/accrued payable). Cash flow dari akun ini diklasifikasikan sebagai Operating Activity per IAS 7.14. Pinjaman bank/long-term debt dikecualikan (tetap Financing).';

-- 2) Backfill is_trade_receivable untuk akun yang JELAS trade receivable.
--    Aturan konservatif (match dengan heuristic existing):
--      - account_type = 'ASSET'
--      - bukan talangan/advance (default_category FIN ATAU name match talangan/advance)
--      - DAN salah satu dari:
--          (a) account_code = '1140' (akun piutang default dari migration 003)
--          (b) default_category = 'EARN' (eksplisit ditandai sebagai pendapatan)
--          (c) name mengandung 'piutang usaha' / 'piutang dagang' / 'trade receivable' /
--              'account receivable' / 'accounts receivable'
UPDATE accounts
SET is_trade_receivable = TRUE
WHERE
  account_type = 'ASSET'
  AND default_category IS DISTINCT FROM 'FIN'
  AND LOWER(account_name) NOT LIKE '%talangan%'
  AND LOWER(account_name) NOT LIKE '%advance%'
  AND (
    account_code = '1140'
    OR default_category = 'EARN'
    OR LOWER(account_name) LIKE '%piutang usaha%'
    OR LOWER(account_name) LIKE '%piutang dagang%'
    OR LOWER(account_name) LIKE '%piutang pelanggan%'
    OR LOWER(account_name) LIKE '%trade receivable%'
    OR LOWER(account_name) LIKE '%account receivable%'
    OR LOWER(account_name) LIKE '%accounts receivable%'
  );

-- 3) Backfill is_operating_payable untuk hutang operasional (bukan pinjaman bank).
--    Aturan konservatif:
--      - account_type = 'LIABILITY'
--      - bukan pinjaman/loan (default_category FIN dengan nama yang mengandung pinjaman/loan/kredit/hutang bank)
--      - DAN salah satu dari:
--          (a) default_category IN ('OPEX', 'VAR', 'TAX') (eksplisit dari kategori beban operasional)
--          (b) name mengandung 'hutang usaha' / 'utang usaha' / 'hutang dagang' /
--              'trade payable' / 'account payable' / 'accounts payable' / 'accrued'
UPDATE accounts
SET is_operating_payable = TRUE
WHERE
  account_type = 'LIABILITY'
  AND NOT (
    default_category = 'FIN'
    AND (
      LOWER(account_name) LIKE '%pinjaman%'
      OR LOWER(account_name) LIKE '%loan%'
      OR LOWER(account_name) LIKE '%kredit bank%'
      OR LOWER(account_name) LIKE '%hutang bank%'
      OR LOWER(account_name) LIKE '%utang bank%'
    )
  )
  AND (
    default_category IN ('OPEX', 'VAR', 'TAX')
    OR LOWER(account_name) LIKE '%hutang usaha%'
    OR LOWER(account_name) LIKE '%utang usaha%'
    OR LOWER(account_name) LIKE '%hutang dagang%'
    OR LOWER(account_name) LIKE '%utang dagang%'
    OR LOWER(account_name) LIKE '%trade payable%'
    OR LOWER(account_name) LIKE '%account payable%'
    OR LOWER(account_name) LIKE '%accounts payable%'
    OR LOWER(account_name) LIKE '%accrued%'
  );

-- 4) Update create_default_accounts: akun default 1100/1200 tetap FALSE untuk
--    kedua flag. Tidak ada perubahan logic untuk akun selain memastikan flag
--    baru disebutkan eksplisit (default sudah FALSE jadi sebenarnya tidak wajib,
--    tapi disebutkan agar future migration yang baca proc ini jelas).
CREATE OR REPLACE FUNCTION public.create_default_accounts(p_business_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_asset_id UUID;
    v_liability_id UUID;
    v_equity_id UUID;
    v_revenue_id UUID;
    v_expense_id UUID;
BEGIN
    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description)
    VALUES (p_business_id, '1000', 'Assets', 'ASSET', NULL, 'DEBIT', TRUE, 1000, 'Semua aset bisnis')
    RETURNING id INTO v_asset_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description)
    VALUES (p_business_id, '2000', 'Liabilities', 'LIABILITY', NULL, 'CREDIT', TRUE, 2000, 'Semua kewajiban bisnis')
    RETURNING id INTO v_liability_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description)
    VALUES (p_business_id, '3000', 'Equity', 'EQUITY', NULL, 'CREDIT', TRUE, 3000, 'Modal dan ekuitas pemilik')
    RETURNING id INTO v_equity_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description)
    VALUES (p_business_id, '4000', 'Revenue', 'REVENUE', NULL, 'CREDIT', TRUE, 4000, 'Semua pendapatan bisnis')
    RETURNING id INTO v_revenue_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description)
    VALUES (p_business_id, '5000', 'Expenses', 'EXPENSE', NULL, 'DEBIT', TRUE, 5000, 'Semua beban bisnis')
    RETURNING id INTO v_expense_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description, default_category, is_retained_earnings, is_cash_equivalent, is_trade_receivable, is_operating_payable) VALUES
    (p_business_id, '1100', 'Cash', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1100, 'Kas tunai', NULL, FALSE, TRUE, FALSE, FALSE),
    (p_business_id, '1200', 'Bank', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1200, 'Rekening bank', NULL, FALSE, TRUE, FALSE, FALSE),
    (p_business_id, '1300', 'Fixed Assets', 'ASSET', v_asset_id, 'DEBIT', FALSE, 1300, 'Aset tetap / peralatan', 'CAPEX', FALSE, FALSE, FALSE, FALSE),
    (p_business_id, '2100', 'Loans Payable', 'LIABILITY', v_liability_id, 'CREDIT', FALSE, 2100, 'Utang pinjaman', 'FIN', FALSE, FALSE, FALSE, FALSE),
    (p_business_id, '3100', 'Owner''s Capital', 'EQUITY', v_equity_id, 'CREDIT', TRUE, 3100, 'Modal pemilik', 'FIN', FALSE, FALSE, FALSE, FALSE),
    (p_business_id, '3200', 'Retained Earnings', 'EQUITY', v_equity_id, 'CREDIT', TRUE, 3200, 'Laba ditahan dari operasi bisnis', 'FIN', TRUE, FALSE, FALSE, FALSE),
    (p_business_id, '4100', 'Sales Revenue', 'REVENUE', v_revenue_id, 'CREDIT', TRUE, 4100, 'Pendapatan penjualan', 'EARN', FALSE, FALSE, FALSE, FALSE),
    (p_business_id, '5100', 'Operating Expenses', 'EXPENSE', v_expense_id, 'DEBIT', TRUE, 5100, 'Beban operasional', 'OPEX', FALSE, FALSE, FALSE, FALSE),
    (p_business_id, '5200', 'Variable Cost (COGS)', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5200, 'Biaya variabel / harga pokok penjualan', 'VAR', FALSE, FALSE, FALSE, FALSE),
    (p_business_id, '5300', 'Tax Expenses', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5300, 'Beban pajak', 'TAX', FALSE, FALSE, FALSE, FALSE);
END;
$function$;

-- 5) Optional: index untuk query yang sering filter by flag (mis. AR/AP aging).
--    Partial index hanya menyimpan row dengan flag TRUE — kecil & cepat.
CREATE INDEX IF NOT EXISTS idx_accounts_trade_receivable
  ON accounts (business_id) WHERE is_trade_receivable = TRUE;

CREATE INDEX IF NOT EXISTS idx_accounts_operating_payable
  ON accounts (business_id) WHERE is_operating_payable = TRUE;

-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_accounts_trade_receivable;
--   DROP INDEX IF EXISTS idx_accounts_operating_payable;
--   DROP FUNCTION IF EXISTS public.create_default_accounts(uuid);
--   -- Lalu redeploy versi sebelumnya (migration 071).
--   ALTER TABLE accounts DROP COLUMN IF EXISTS is_trade_receivable;
--   ALTER TABLE accounts DROP COLUMN IF EXISTS is_operating_payable;
