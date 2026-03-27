-- Migration: Update default_category for existing accounts
-- Created: 2026-02-13
-- Purpose: Set default categories for existing essential sub-accounts

-- ============================================================================
-- UPDATE EXISTING ESSENTIAL SUB-ACCOUNTS
-- ============================================================================

-- Update Sales Revenue accounts to EARN
UPDATE accounts
SET default_category = 'EARN'
WHERE account_code = '4100'
  AND account_name = 'Sales Revenue'
  AND default_category IS NULL;

-- Update Operating Expenses accounts to OPEX
UPDATE accounts
SET default_category = 'OPEX'
WHERE account_code = '5100'
  AND account_name = 'Operating Expenses'
  AND default_category IS NULL;

-- ============================================================================
-- OPTIONAL: UPDATE USER-CREATED ACCOUNTS (EXAMPLES)
-- ============================================================================

-- Note: Users who created custom accounts like "Variable Cost" can manually
-- set the default_category via the UI (Chart of Accounts > Edit Account).
--
-- Alternatively, they can run SQL updates like:
-- UPDATE accounts SET default_category = 'VAR' WHERE account_code = '5200' AND account_name LIKE '%Variable%';
-- UPDATE accounts SET default_category = 'TAX' WHERE account_code = '5300' AND account_name LIKE '%Tax%';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT
    'Migration 008 complete!' as status,
    COUNT(*) FILTER (WHERE default_category IS NOT NULL) as accounts_with_category,
    COUNT(*) as total_accounts
FROM accounts;

-- Show updated accounts
SELECT account_code, account_name, account_type, default_category
FROM accounts
WHERE default_category IS NOT NULL
ORDER BY account_code;
