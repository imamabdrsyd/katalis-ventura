-- Migration: Add Double-Entry Bookkeeping
-- Created: 2025-02-01
-- Description: Adds accounts table and double-entry fields to transactions

-- ============================================================================
-- 1. CREATE ACCOUNTS TABLE (Chart of Accounts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT CHECK (account_type IN (
        'ASSET',
        'LIABILITY',
        'EQUITY',
        'REVENUE',
        'EXPENSE'
    )) NOT NULL,
    parent_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    normal_balance TEXT CHECK (normal_balance IN ('DEBIT', 'CREDIT')) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(business_id, account_code)
);

-- Create indexes for accounts table
CREATE INDEX IF NOT EXISTS idx_accounts_business_id ON accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(business_id, account_code);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);

-- Add trigger for updated_at
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. MODIFY TRANSACTIONS TABLE
-- ============================================================================

-- Add double-entry columns (nullable for backward compatibility)
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS debit_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS credit_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_double_entry BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_transactions_debit_account ON transactions(debit_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_credit_account ON transactions(credit_account_id);

-- Add constraint: debit and credit must be different
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_different_accounts'
    ) THEN
        ALTER TABLE transactions
            ADD CONSTRAINT check_different_accounts
            CHECK (
                debit_account_id IS NULL OR
                credit_account_id IS NULL OR
                debit_account_id != credit_account_id
            );
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN transactions.account IS 'Legacy account field (text). Use debit_account_id and credit_account_id for double-entry.';
COMMENT ON COLUMN transactions.is_double_entry IS 'TRUE if transaction uses double-entry (debit/credit accounts), FALSE for legacy transactions.';

-- ============================================================================
-- 3. CREATE DEFAULT ACCOUNTS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_accounts(p_business_id UUID)
RETURNS VOID AS $$
DECLARE
    v_asset_id UUID;
    v_liability_id UUID;
    v_equity_id UUID;
    v_revenue_id UUID;
    v_expense_id UUID;
BEGIN
    -- ========================================
    -- 5 MAIN PARENT ACCOUNTS (System, cannot be modified)
    -- ========================================

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

    -- ========================================
    -- ESSENTIAL SUB-ACCOUNTS (for convenience)
    -- Users can add more sub-accounts as needed
    -- ========================================

    -- Asset sub-accounts
    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description) VALUES
    (p_business_id, '1100', 'Cash', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1100, 'Kas tunai'),
    (p_business_id, '1200', 'Bank', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1200, 'Rekening bank');

    -- Revenue sub-accounts
    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description) VALUES
    (p_business_id, '4100', 'Sales Revenue', 'REVENUE', v_revenue_id, 'CREDIT', TRUE, 4100, 'Pendapatan penjualan');

    -- Expense sub-accounts
    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description) VALUES
    (p_business_id, '5100', 'Operating Expenses', 'EXPENSE', v_expense_id, 'DEBIT', TRUE, 5100, 'Beban operasional');

END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. CREATE TRIGGER FOR NEW BUSINESSES
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_create_default_accounts()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_default_accounts(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS business_create_accounts ON businesses;

CREATE TRIGGER business_create_accounts
    AFTER INSERT ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION trigger_create_default_accounts();

-- ============================================================================
-- 5. ROW LEVEL SECURITY FOR ACCOUNTS
-- ============================================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist
DROP POLICY IF EXISTS "Users can view accounts for their businesses" ON accounts;
DROP POLICY IF EXISTS "Managers can manage accounts" ON accounts;

CREATE POLICY "Users can view accounts for their businesses"
    ON accounts FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM user_business_roles
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can manage accounts"
    ON accounts FOR ALL
    USING (
        business_id IN (
            SELECT business_id FROM user_business_roles
            WHERE user_id = auth.uid()
            AND role IN ('business_manager', 'both')
        )
    );

-- ============================================================================
-- 6. BACKFILL ACCOUNTS FOR EXISTING BUSINESSES
-- ============================================================================

-- Create accounts for all existing businesses that don't have them yet
DO $$
DECLARE
    business_record RECORD;
BEGIN
    FOR business_record IN
        SELECT id FROM businesses
        WHERE id NOT IN (SELECT DISTINCT business_id FROM accounts)
    LOOP
        PERFORM create_default_accounts(business_record.id);
    END LOOP;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify migration
SELECT
    'Migration complete!' as status,
    COUNT(DISTINCT business_id) as businesses_with_accounts,
    COUNT(*) as total_accounts
FROM accounts;
