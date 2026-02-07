-- Migration: Convert capital_investment to CAPEX transactions
-- Created: 2025-02-08
-- Description: For businesses with capital_investment > 0, create a CAPEX transaction
--              representing the initial capital, then set capital_investment to 0

-- ============================================================================
-- STRATEGY
-- ============================================================================
-- For each business with capital_investment > 0:
-- 1. Find the earliest transaction date for that business (or use created_at if no transactions)
-- 2. Create a double-entry CAPEX transaction:
--    - Debit: 1110 (Cash) for the capital amount
--    - Credit: 3100 (Capital) for the capital amount
-- 3. Set business.capital_investment to 0
-- ============================================================================

DO $$
DECLARE
    business_record RECORD;
    earliest_date DATE;
    cash_account_id UUID;
    capital_account_id UUID;
BEGIN
    -- Loop through all businesses with capital_investment > 0
    FOR business_record IN
        SELECT id, capital_investment, created_by, created_at
        FROM businesses
        WHERE capital_investment > 0
    LOOP
        RAISE NOTICE 'Processing business: %', business_record.id;

        -- Find earliest transaction date or use created_at
        SELECT MIN(date) INTO earliest_date
        FROM transactions
        WHERE business_id = business_record.id;

        IF earliest_date IS NULL THEN
            -- No transactions exist, use business created_at date
            earliest_date := DATE(business_record.created_at);
        END IF;

        -- Get account IDs for this business
        SELECT id INTO cash_account_id
        FROM accounts
        WHERE business_id = business_record.id
        AND account_code = '1110' -- Cash account
        LIMIT 1;

        SELECT id INTO capital_account_id
        FROM accounts
        WHERE business_id = business_record.id
        AND account_code = '3100' -- Capital account
        LIMIT 1;

        -- Verify accounts exist
        IF cash_account_id IS NULL OR capital_account_id IS NULL THEN
            RAISE WARNING 'Accounts not found for business %. Skipping.', business_record.id;
            CONTINUE;
        END IF;

        -- Create the CAPEX transaction
        INSERT INTO transactions (
            business_id,
            date,
            category,
            name,
            description,
            amount,
            account,
            debit_account_id,
            credit_account_id,
            is_double_entry,
            created_by,
            created_at,
            updated_at
        ) VALUES (
            business_record.id,
            earliest_date,
            'CAPEX',
            'Modal Awal',
            'Modal Awal (Migrasi Otomatis dari capital_investment)',
            business_record.capital_investment,
            'Cash', -- Legacy field
            cash_account_id, -- Debit: Cash (Asset increases)
            capital_account_id, -- Credit: Capital (Equity increases)
            TRUE,
            business_record.created_by,
            NOW(),
            NOW()
        );

        RAISE NOTICE 'Created CAPEX transaction for business % with amount %',
            business_record.id, business_record.capital_investment;

        -- Set capital_investment to 0 (keep for audit trail)
        UPDATE businesses
        SET capital_investment = 0
        WHERE id = business_record.id;

        RAISE NOTICE 'Set capital_investment to 0 for business %', business_record.id;

    END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify migration results
SELECT
    'Migration complete!' as status,
    COUNT(*) as total_businesses,
    COUNT(CASE WHEN capital_investment > 0 THEN 1 END) as businesses_with_capital_remaining,
    COUNT(CASE WHEN capital_investment = 0 THEN 1 END) as businesses_migrated
FROM businesses;

-- Show migrated transactions
SELECT
    b.business_name,
    t.date,
    t.amount,
    t.description,
    da.account_name as debit_account,
    ca.account_name as credit_account
FROM transactions t
JOIN businesses b ON t.business_id = b.id
LEFT JOIN accounts da ON t.debit_account_id = da.id
LEFT JOIN accounts ca ON t.credit_account_id = ca.id
WHERE t.description = 'Modal Awal (Migrasi Otomatis dari capital_investment)'
ORDER BY b.business_name, t.date;
