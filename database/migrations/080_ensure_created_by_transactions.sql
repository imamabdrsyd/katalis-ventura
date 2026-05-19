-- Migration 080: Ensure created_by is always set on transactions
-- Purpose: Add trigger to auto-populate created_by on INSERT if NULL
-- Prevents orphaned transactions with NULL created_by
-- Date: 2026-05-19

-- ============================================================================
-- PART 1: IMPROVE set_created_by FUNCTION TO HANDLE MULTIPLE TABLES
-- ============================================================================

CREATE OR REPLACE FUNCTION set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set created_by if it's NULL and we're in an authenticated context
  -- This will be NULL for service role operations, which we log as a notice
  IF NEW.created_by IS NULL THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    ELSE
      -- Log when created_by remains NULL (service role operation)
      RAISE NOTICE 'Warning: % insert with NULL created_by (service role operation)', TG_TABLE_NAME;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_created_by() IS 'Auto-populate created_by from auth.uid() on INSERT if NULL';

-- ============================================================================
-- PART 2: ATTACH set_created_by TRIGGER TO TRANSACTIONS
-- ============================================================================

DROP TRIGGER IF EXISTS transactions_set_created_by ON transactions;
CREATE TRIGGER transactions_set_created_by
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- ============================================================================
-- PART 3: MAKE created_by NOT NULL (OPTIONAL - ONLY IF NO LEGACY DATA)
-- ============================================================================

-- Check if there are any transactions with NULL created_by
-- If none found, we can safely add NOT NULL constraint
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM transactions WHERE created_by IS NULL;

  IF null_count = 0 THEN
    -- No NULL values, safe to add constraint
    ALTER TABLE transactions
    ALTER COLUMN created_by SET NOT NULL;
    RAISE NOTICE '✅ created_by column set to NOT NULL on transactions';
  ELSE
    RAISE NOTICE '⚠️  Found % transactions with NULL created_by. Skipping NOT NULL constraint.', null_count;
    RAISE NOTICE '    Consider backfilling these records or running cleanup.';
  END IF;
END $$;

-- ============================================================================
-- PART 4: VERIFY TRIGGER IS ATTACHED
-- ============================================================================

SELECT
  'Trigger verification' as status,
  COUNT(*) as total_triggers,
  COUNT(CASE WHEN trigger_name = 'transactions_set_created_by' THEN 1 END) as created_by_trigger_attached,
  COUNT(CASE WHEN trigger_name = 'set_transactions_updated_by' THEN 1 END) as updated_by_trigger_attached
FROM information_schema.triggers
WHERE event_object_table = 'transactions'
GROUP BY trigger_name IS NOT NULL;
