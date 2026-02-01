-- Migration: Add Loan Receivable Account
-- Created: 2025-02-02
-- Description: Adds "Piutang (Loan Receivable)" account to chart of accounts

-- ============================================================================
-- ADD LOAN RECEIVABLE ACCOUNT TO EXISTING BUSINESSES
-- ============================================================================

-- Update the create_default_accounts function to include Loan Receivable
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
    -- NEW: Loan Receivable
    (p_business_id, '1140', 'Piutang (Loan Receivable)', 'ASSET', 'DEBIT', TRUE, 118, 'Piutang usaha dan pinjaman'),

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

-- Add Loan Receivable account to all existing businesses
INSERT INTO accounts (business_id, account_code, account_name, account_type, normal_balance, is_system, sort_order, description)
SELECT
    id as business_id,
    '1140' as account_code,
    'Piutang (Loan Receivable)' as account_name,
    'ASSET' as account_type,
    'DEBIT' as normal_balance,
    TRUE as is_system,
    118 as sort_order,
    'Piutang usaha dan pinjaman' as description
FROM businesses
WHERE id NOT IN (
    SELECT business_id
    FROM accounts
    WHERE account_code = '1140'
);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT
    'Migration 003 complete - Loan Receivable account added' as status,
    COUNT(*) as businesses_updated
FROM businesses;
