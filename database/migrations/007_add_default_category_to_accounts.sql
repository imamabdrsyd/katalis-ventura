-- Migration: Add default_category field to accounts table
-- Created: 2026-02-13
-- Purpose: Allow auto-detection of transaction category based on account selection

-- ============================================================================
-- 1. ADD default_category COLUMN
-- ============================================================================

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS default_category TEXT
CHECK (default_category IN ('EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'));

-- ============================================================================
-- 2. ADD INDEX FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_accounts_default_category ON accounts(default_category)
WHERE default_category IS NOT NULL;

-- ============================================================================
-- 3. ADD COLUMN COMMENT
-- ============================================================================

COMMENT ON COLUMN accounts.default_category IS 'Default transaction category when this account is used. If NULL, category will be auto-detected from account type.';

-- ============================================================================
-- 4. UPDATE EXISTING ESSENTIAL SUB-ACCOUNTS
-- ============================================================================

-- Update Sales Revenue to auto-detect as EARN
UPDATE accounts
SET default_category = 'EARN'
WHERE account_code = '4100' AND account_name = 'Sales Revenue';

-- Update Operating Expenses to auto-detect as OPEX
UPDATE accounts
SET default_category = 'OPEX'
WHERE account_code = '5100' AND account_name = 'Operating Expenses';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify migration
SELECT
    'Migration 007 complete!' as status,
    COUNT(*) as total_accounts,
    COUNT(default_category) as accounts_with_category
FROM accounts;
