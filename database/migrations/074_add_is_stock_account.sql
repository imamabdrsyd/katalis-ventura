-- Migration 074: Tambah flag is_stock pada tabel accounts
--
-- Tujuan: menandai akun EQUITY yang merepresentasikan modal disetor
-- pemilik/investor. Flag ini menjadi denominator ROI dashboard:
--   gross invested capital = kredit ke akun EQUITY is_stock
--   remaining invested capital = gross invested capital - debit ke akun
--   stock/dividen/prive.

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS is_stock BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN accounts.is_stock IS
  'Menandai akun EQUITY sebagai modal disetor pemilik/investor yang dipakai sebagai denominator ROI dashboard.';

-- Backfill konservatif untuk akun modal pemilik existing.
UPDATE accounts
SET is_stock = TRUE
WHERE account_type = 'EQUITY'
  AND is_stock = FALSE
  AND (
    account_code = '3100'
    OR LOWER(account_name) LIKE '%owner%capital%'
    OR LOWER(account_name) LIKE '%capital%'
    OR LOWER(account_name) LIKE '%modal%'
  )
  AND COALESCE(is_retained_earnings, FALSE) = FALSE
  AND COALESCE(is_dividend, FALSE) = FALSE;

-- Akun laba ditahan dan dividen/prive bukan modal disetor.
UPDATE accounts
SET is_stock = FALSE
WHERE account_type = 'EQUITY'
  AND (
    COALESCE(is_retained_earnings, FALSE) = TRUE
    OR COALESCE(is_dividend, FALSE) = TRUE
  );

-- Update default accounts supaya bisnis baru langsung memiliki Owner's Capital
-- yang ditandai sebagai stock.
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

    INSERT INTO accounts (
      business_id,
      account_code,
      account_name,
      account_type,
      parent_account_id,
      normal_balance,
      is_system,
      sort_order,
      description,
      default_category,
      is_retained_earnings,
      is_cash_equivalent,
      is_stock
    ) VALUES
    (p_business_id, '1100', 'Cash', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1100, 'Kas tunai', NULL, FALSE, TRUE, FALSE),
    (p_business_id, '1200', 'Bank', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1200, 'Rekening bank', NULL, FALSE, TRUE, FALSE),
    (p_business_id, '1300', 'Fixed Assets', 'ASSET', v_asset_id, 'DEBIT', FALSE, 1300, 'Aset tetap / peralatan', 'CAPEX', FALSE, FALSE, FALSE),
    (p_business_id, '2100', 'Loans Payable', 'LIABILITY', v_liability_id, 'CREDIT', FALSE, 2100, 'Utang pinjaman', 'FIN', FALSE, FALSE, FALSE),
    (p_business_id, '3100', 'Owner''s Capital', 'EQUITY', v_equity_id, 'CREDIT', TRUE, 3100, 'Modal pemilik', 'FIN', FALSE, FALSE, TRUE),
    (p_business_id, '3200', 'Retained Earnings', 'EQUITY', v_equity_id, 'CREDIT', TRUE, 3200, 'Laba ditahan dari operasi bisnis', 'FIN', TRUE, FALSE, FALSE),
    (p_business_id, '4100', 'Sales Revenue', 'REVENUE', v_revenue_id, 'CREDIT', TRUE, 4100, 'Pendapatan penjualan', 'EARN', FALSE, FALSE, FALSE),
    (p_business_id, '5100', 'Operating Expenses', 'EXPENSE', v_expense_id, 'DEBIT', TRUE, 5100, 'Beban operasional', 'OPEX', FALSE, FALSE, FALSE),
    (p_business_id, '5200', 'Variable Cost (COGS)', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5200, 'Biaya variabel / harga pokok penjualan', 'VAR', FALSE, FALSE, FALSE),
    (p_business_id, '5300', 'Tax Expenses', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5300, 'Beban pajak', 'TAX', FALSE, FALSE, FALSE);
END;
$function$;

SELECT 'Migration 074 complete - is_stock column added and owner capital accounts backfilled' as status;
