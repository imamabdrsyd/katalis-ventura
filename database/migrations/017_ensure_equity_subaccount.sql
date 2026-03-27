-- Migration 016: Ensure Owner's Capital sub-account (3100) exists for all businesses
-- Reason: The original create_default_accounts function (migration 001) did not include
--         a 3100 sub-account under Equity (3000). This was added in migration 012,
--         but if that migration hasn't been applied or the function wasn't updated,
--         new businesses won't have 3100 and capital investment transactions will fail silently.

-- Step 1: Update the stored procedure to include 3100 (idempotent with migration 012)
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

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description, default_category) VALUES
    (p_business_id, '1100', 'Cash', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1100, 'Kas tunai', NULL),
    (p_business_id, '1200', 'Bank', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1200, 'Rekening bank', NULL),
    (p_business_id, '1300', 'Fixed Assets', 'ASSET', v_asset_id, 'DEBIT', FALSE, 1300, 'Aset tetap / peralatan', 'CAPEX'),
    (p_business_id, '2100', 'Loans Payable', 'LIABILITY', v_liability_id, 'CREDIT', FALSE, 2100, 'Utang pinjaman', 'FIN'),
    (p_business_id, '3100', 'Owner''s Capital', 'EQUITY', v_equity_id, 'CREDIT', TRUE, 3100, 'Modal pemilik', 'FIN'),
    (p_business_id, '4100', 'Sales Revenue', 'REVENUE', v_revenue_id, 'CREDIT', TRUE, 4100, 'Pendapatan penjualan', 'EARN'),
    (p_business_id, '5100', 'Operating Expenses', 'EXPENSE', v_expense_id, 'DEBIT', TRUE, 5100, 'Beban operasional', 'OPEX'),
    (p_business_id, '5200', 'Variable Cost (COGS)', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5200, 'Biaya variabel / harga pokok penjualan', 'VAR'),
    (p_business_id, '5300', 'Tax Expenses', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5300, 'Beban pajak', 'TAX');
END;
$$;

-- Step 2: Backfill 3100 for existing businesses that have 3000 but not 3100
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT b.id AS business_id, a.id AS equity_parent_id
        FROM businesses b
        JOIN accounts a ON a.business_id = b.id AND a.account_code = '3000'
        WHERE NOT EXISTS (
            SELECT 1 FROM accounts a2
            WHERE a2.business_id = b.id AND a2.account_code = '3100'
        )
    LOOP
        INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description, default_category)
        VALUES (rec.business_id, '3100', 'Owner''s Capital', 'EQUITY', rec.equity_parent_id, 'CREDIT', TRUE, 3100, 'Modal pemilik', 'FIN');
    END LOOP;
END $$;

SELECT 'Migration 016 complete - Owner''s Capital (3100) ensured for all businesses' as status;
