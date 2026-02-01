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
BEGIN
    -- ASSETS (1000-1999)
    INSERT INTO accounts (business_id, account_code, account_name, account_type, normal_balance, is_system, sort_order, description) VALUES
    (p_business_id, '1100', 'Current Assets', 'ASSET', 'DEBIT', TRUE, 110, 'Aset lancar'),
    (p_business_id, '1110', 'Cash', 'ASSET', 'DEBIT', TRUE, 111, 'Kas tunai'),
    (p_business_id, '1120', 'Bank - BCA', 'ASSET', 'DEBIT', TRUE, 112, 'Rekening Bank BCA'),
    (p_business_id, '1121', 'Bank - Mandiri', 'ASSET', 'DEBIT', TRUE, 113, 'Rekening Bank Mandiri'),
    (p_business_id, '1122', 'Bank - BNI', 'ASSET', 'DEBIT', TRUE, 114, 'Rekening Bank BNI'),
    (p_business_id, '1130', 'E-Wallet - OVO', 'ASSET', 'DEBIT', TRUE, 115, 'E-wallet OVO'),
    (p_business_id, '1131', 'E-Wallet - GoPay', 'ASSET', 'DEBIT', TRUE, 116, 'E-wallet GoPay'),
    (p_business_id, '1132', 'E-Wallet - Dana', 'ASSET', 'DEBIT', TRUE, 117, 'E-wallet Dana'),

    (p_business_id, '1200', 'Fixed Assets', 'ASSET', 'DEBIT', TRUE, 120, 'Aset tetap'),
    (p_business_id, '1210', 'Property - Building', 'ASSET', 'DEBIT', TRUE, 121, 'Properti sewa'),
    (p_business_id, '1220', 'Furniture & Fixtures', 'ASSET', 'DEBIT', TRUE, 122, 'Furniture dan perlengkapan'),
    (p_business_id, '1230', 'Equipment', 'ASSET', 'DEBIT', TRUE, 123, 'Peralatan'),
    (p_business_id, '1240', 'Accumulated Depreciation', 'ASSET', 'CREDIT', TRUE, 124, 'Akumulasi penyusutan'),

    -- LIABILITIES (2000-2999)
    (p_business_id, '2100', 'Current Liabilities', 'LIABILITY', 'CREDIT', TRUE, 210, 'Liabilitas jangka pendek'),
    (p_business_id, '2110', 'Accounts Payable', 'LIABILITY', 'CREDIT', TRUE, 211, 'Hutang usaha'),
    (p_business_id, '2120', 'Utilities Payable', 'LIABILITY', 'CREDIT', TRUE, 212, 'Hutang utilitas'),

    (p_business_id, '2200', 'Long-term Liabilities', 'LIABILITY', 'CREDIT', TRUE, 220, 'Liabilitas jangka panjang'),
    (p_business_id, '2210', 'Loan Payable', 'LIABILITY', 'CREDIT', TRUE, 221, 'Pinjaman bank'),

    -- EQUITY (3000-3999)
    (p_business_id, '3100', 'Capital', 'EQUITY', 'CREDIT', TRUE, 310, 'Modal pemilik'),
    (p_business_id, '3200', 'Retained Earnings', 'EQUITY', 'CREDIT', TRUE, 320, 'Laba ditahan'),
    (p_business_id, '3300', 'Owner Drawings', 'EQUITY', 'DEBIT', TRUE, 330, 'Penarikan pemilik'),

    -- REVENUE (4000-4999)
    (p_business_id, '4100', 'Rental Income', 'REVENUE', 'CREDIT', TRUE, 410, 'Pendapatan sewa'),
    (p_business_id, '4200', 'Service Fees', 'REVENUE', 'CREDIT', TRUE, 420, 'Biaya layanan'),
    (p_business_id, '4300', 'Other Income', 'REVENUE', 'CREDIT', TRUE, 430, 'Pendapatan lain-lain'),

    -- EXPENSES (5000-5999)
    -- Operating Expenses (OPEX)
    (p_business_id, '5110', 'Utilities - Electricity', 'EXPENSE', 'DEBIT', TRUE, 511, 'Listrik'),
    (p_business_id, '5111', 'Utilities - Water', 'EXPENSE', 'DEBIT', TRUE, 512, 'Air'),
    (p_business_id, '5112', 'Utilities - Gas', 'EXPENSE', 'DEBIT', TRUE, 513, 'Gas'),
    (p_business_id, '5113', 'Internet & Phone', 'EXPENSE', 'DEBIT', TRUE, 514, 'Internet dan telepon'),
    (p_business_id, '5120', 'Property Maintenance', 'EXPENSE', 'DEBIT', TRUE, 515, 'Pemeliharaan properti'),
    (p_business_id, '5130', 'Insurance', 'EXPENSE', 'DEBIT', TRUE, 516, 'Asuransi'),
    (p_business_id, '5140', 'Management Fees', 'EXPENSE', 'DEBIT', TRUE, 517, 'Biaya manajemen'),
    (p_business_id, '5150', 'Marketing & Advertising', 'EXPENSE', 'DEBIT', TRUE, 518, 'Pemasaran dan iklan'),

    -- Variable Costs (VAR)
    (p_business_id, '5210', 'Cleaning Services', 'EXPENSE', 'DEBIT', TRUE, 521, 'Biaya kebersihan'),
    (p_business_id, '5220', 'Guest Amenities', 'EXPENSE', 'DEBIT', TRUE, 522, 'Amenitas tamu'),
    (p_business_id, '5230', 'Laundry', 'EXPENSE', 'DEBIT', TRUE, 523, 'Laundry'),
    (p_business_id, '5240', 'Platform Commission', 'EXPENSE', 'DEBIT', TRUE, 524, 'Komisi platform'),

    -- Taxes (TAX)
    (p_business_id, '5310', 'Income Tax', 'EXPENSE', 'DEBIT', TRUE, 531, 'Pajak penghasilan'),
    (p_business_id, '5320', 'Property Tax', 'EXPENSE', 'DEBIT', TRUE, 532, 'Pajak bumi bangunan (PBB)'),
    (p_business_id, '5330', 'VAT', 'EXPENSE', 'DEBIT', TRUE, 533, 'PPN'),

    -- Financing (FIN)
    (p_business_id, '5410', 'Interest Expense', 'EXPENSE', 'DEBIT', TRUE, 541, 'Bunga pinjaman');

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
