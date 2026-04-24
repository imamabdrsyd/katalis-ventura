-- Migration 047: Tambah kolom is_retained_earnings pada tabel accounts
-- Menggantikan deteksi fragile berbasis kode akun 3200 atau nama regex
-- dengan penanda semantik eksplisit yang bisa di-set oleh user.

-- Step 1: Tambah kolom
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS is_retained_earnings BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN accounts.is_retained_earnings IS
  'Menandai akun EQUITY ini sebagai tujuan transfer laba/rugi saat Tutup Buku (Closing Entry). Hanya satu akun per bisnis yang boleh bernilai TRUE.';

-- Step 2: Partial unique index — hanya satu per bisnis yang boleh TRUE
-- Menggunakan partial index (bukan trigger) agar clear-then-set bisa berjalan
-- dalam satu transaksi tanpa melanggar constraint di tengah jalan.
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_one_retained_earnings_per_business
  ON accounts (business_id)
  WHERE is_retained_earnings = TRUE;

-- Step 3: Backfill — bisnis yang sudah punya akun EQUITY kode 3200 + aktif
UPDATE accounts
  SET is_retained_earnings = TRUE
WHERE account_type = 'EQUITY'
  AND account_code = '3200'
  AND is_active = TRUE
  AND is_retained_earnings = FALSE;

-- Step 4: Update create_default_accounts agar bisnis baru langsung dapat
-- akun Laba Ditahan yang termarkir. Ini meneruskan versi dari migration 017
-- dengan tambahan: kolom is_retained_earnings pada row 3200.
CREATE OR REPLACE FUNCTION create_default_accounts(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description, default_category, is_retained_earnings) VALUES
    (p_business_id, '1100', 'Cash', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1100, 'Kas tunai', NULL, FALSE),
    (p_business_id, '1200', 'Bank', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1200, 'Rekening bank', NULL, FALSE),
    (p_business_id, '1300', 'Fixed Assets', 'ASSET', v_asset_id, 'DEBIT', FALSE, 1300, 'Aset tetap / peralatan', 'CAPEX', FALSE),
    (p_business_id, '2100', 'Loans Payable', 'LIABILITY', v_liability_id, 'CREDIT', FALSE, 2100, 'Utang pinjaman', 'FIN', FALSE),
    (p_business_id, '3100', 'Owner''s Capital', 'EQUITY', v_equity_id, 'CREDIT', TRUE, 3100, 'Modal pemilik', 'FIN', FALSE),
    (p_business_id, '3200', 'Retained Earnings', 'EQUITY', v_equity_id, 'CREDIT', TRUE, 3200, 'Laba ditahan dari operasi bisnis', 'FIN', TRUE),
    (p_business_id, '4100', 'Sales Revenue', 'REVENUE', v_revenue_id, 'CREDIT', TRUE, 4100, 'Pendapatan penjualan', 'EARN', FALSE),
    (p_business_id, '5100', 'Operating Expenses', 'EXPENSE', v_expense_id, 'DEBIT', TRUE, 5100, 'Beban operasional', 'OPEX', FALSE),
    (p_business_id, '5200', 'Variable Cost (COGS)', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5200, 'Biaya variabel / harga pokok penjualan', 'VAR', FALSE),
    (p_business_id, '5300', 'Tax Expenses', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5300, 'Beban pajak', 'TAX', FALSE);
END;
$$;

SELECT 'Migration 047 complete - is_retained_earnings column added, backfilled, and create_default_accounts updated' as status;
