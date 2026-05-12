-- Migration 071: Tambah flag is_cash_equivalent ke tabel accounts
--
-- Tujuan: Mengganti hardcode kode akun '1100'/'1200' untuk deteksi kas/setara kas
-- dengan flag boolean yang persisten di DB. Memungkinkan bisnis yang pakai kode
-- akun non-standar (mis. '1101 Kas Kecil', '1210 BCA') tetap terdeteksi sebagai
-- kas pada Cash Flow report, Bank Reconciliation, dan Quick Transaction.

-- 1) Tambah kolom dengan default FALSE — aman untuk semua row existing.
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS is_cash_equivalent BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Backfill konservatif: hanya akun yang kode 1100/1200 DAN namanya match
--    pattern kas/cash/bank. Strategi ini menghindari false positive di bisnis
--    yang sudah pakai 1100/1200 untuk Current Assets / Fixed Assets.
UPDATE accounts
SET is_cash_equivalent = TRUE
WHERE
  account_code IN ('1100', '1200')
  AND account_type = 'ASSET'
  AND (
    LOWER(account_name) LIKE '%kas%'
    OR LOWER(account_name) LIKE '%cash%'
    OR LOWER(account_name) LIKE '%bank%'
  );

-- 3) Update create_default_accounts: bisnis baru yang dibuat setelah migration
--    ini langsung mendapatkan flag is_cash_equivalent=TRUE pada akun 1100 & 1200,
--    tanpa perlu backfill ulang.
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

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description, default_category, is_retained_earnings, is_cash_equivalent) VALUES
    (p_business_id, '1100', 'Cash', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1100, 'Kas tunai', NULL, FALSE, TRUE),
    (p_business_id, '1200', 'Bank', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1200, 'Rekening bank', NULL, FALSE, TRUE),
    (p_business_id, '1300', 'Fixed Assets', 'ASSET', v_asset_id, 'DEBIT', FALSE, 1300, 'Aset tetap / peralatan', 'CAPEX', FALSE, FALSE),
    (p_business_id, '2100', 'Loans Payable', 'LIABILITY', v_liability_id, 'CREDIT', FALSE, 2100, 'Utang pinjaman', 'FIN', FALSE, FALSE),
    (p_business_id, '3100', 'Owner''s Capital', 'EQUITY', v_equity_id, 'CREDIT', TRUE, 3100, 'Modal pemilik', 'FIN', FALSE, FALSE),
    (p_business_id, '3200', 'Retained Earnings', 'EQUITY', v_equity_id, 'CREDIT', TRUE, 3200, 'Laba ditahan dari operasi bisnis', 'FIN', TRUE, FALSE),
    (p_business_id, '4100', 'Sales Revenue', 'REVENUE', v_revenue_id, 'CREDIT', TRUE, 4100, 'Pendapatan penjualan', 'EARN', FALSE, FALSE),
    (p_business_id, '5100', 'Operating Expenses', 'EXPENSE', v_expense_id, 'DEBIT', TRUE, 5100, 'Beban operasional', 'OPEX', FALSE, FALSE),
    (p_business_id, '5200', 'Variable Cost (COGS)', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5200, 'Biaya variabel / harga pokok penjualan', 'VAR', FALSE, FALSE),
    (p_business_id, '5300', 'Tax Expenses', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5300, 'Beban pajak', 'TAX', FALSE, FALSE);
END;
$function$;

-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.create_default_accounts(uuid);
--   -- Lalu redeploy versi sebelumnya tanpa kolom is_cash_equivalent.
--   ALTER TABLE accounts DROP COLUMN IF EXISTS is_cash_equivalent;
