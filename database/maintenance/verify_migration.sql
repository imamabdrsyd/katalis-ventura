-- Verification Script: Check if Migration 004 worked correctly
-- Run this to verify audit trail is working

-- ============================================================================
-- 1. CHECK TABLES AND COLUMNS EXIST
-- ============================================================================

SELECT 'Checking audit_log table...' as step;
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'audit_log'
ORDER BY ordinal_position;

SELECT 'Checking transactions audit columns...' as step;
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name IN ('updated_by', 'deleted_at', 'deleted_by')
ORDER BY column_name;

-- ============================================================================
-- 2. CHECK TRIGGERS EXIST
-- ============================================================================

SELECT 'Checking triggers...' as step;
SELECT
  trigger_name,
  event_object_table as table_name,
  event_manipulation as event,
  action_timing
FROM information_schema.triggers
WHERE trigger_name LIKE '%audit%' OR trigger_name LIKE '%updated_by%'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 3. CHECK FUNCTIONS EXIST
-- ============================================================================

SELECT 'Checking functions...' as step;
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%audit%'
    OR routine_name LIKE '%updated_by%'
    OR routine_name LIKE '%soft_delete%'
    OR routine_name LIKE '%restore%')
ORDER BY routine_name;

-- ============================================================================
-- 4. CHECK VIEWS EXIST
-- ============================================================================

SELECT 'Checking views...' as step;
SELECT
  table_name as view_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND (table_name LIKE '%audit%'
    OR table_name LIKE '%transaction%')
ORDER BY table_name;

-- ============================================================================
-- 5. CHECK RLS POLICIES
-- ============================================================================

SELECT 'Checking RLS policies...' as step;
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('audit_log', 'transactions')
ORDER BY tablename, policyname;

-- ============================================================================
-- 6. CHECK INDEXES
-- ============================================================================

SELECT 'Checking indexes...' as step;
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (indexname LIKE '%audit%'
    OR indexname LIKE '%deleted%'
    OR indexname LIKE '%active%')
ORDER BY tablename, indexname;

-- ============================================================================
-- 7. TEST AUDIT LOG (Create a test transaction)
-- ============================================================================

SELECT 'Testing audit trail...' as step;

-- Count current audit logs
SELECT COUNT(*) as current_audit_log_count FROM audit_log;

-- Note: To fully test, you need to create/update/delete a transaction from the app
-- Then check: SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT 5;

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================

DO $$
DECLARE
  audit_table_exists BOOLEAN;
  audit_columns_count INT;
  triggers_count INT;
  functions_count INT;
  views_count INT;
  policies_count INT;
  indexes_count INT;
BEGIN
  RAISE NOTICE '=== MIGRATION 004 VERIFICATION SUMMARY ===';

  -- Check audit_log table
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'audit_log'
  ) INTO audit_table_exists;

  IF audit_table_exists THEN
    RAISE NOTICE '✅ audit_log table exists';
  ELSE
    RAISE NOTICE '❌ audit_log table NOT FOUND';
  END IF;

  -- Check audit columns
  SELECT COUNT(*) INTO audit_columns_count
  FROM information_schema.columns
  WHERE table_name = 'transactions'
    AND column_name IN ('updated_by', 'deleted_at', 'deleted_by');

  IF audit_columns_count = 3 THEN
    RAISE NOTICE '✅ All audit columns added to transactions (3/3)';
  ELSE
    RAISE NOTICE '⚠️  Some audit columns missing (% /3)', audit_columns_count;
  END IF;

  -- Check triggers
  SELECT COUNT(*) INTO triggers_count
  FROM information_schema.triggers
  WHERE trigger_name LIKE '%audit%' OR trigger_name LIKE '%updated_by%';

  IF triggers_count >= 8 THEN
    RAISE NOTICE '✅ All triggers created (% triggers)', triggers_count;
  ELSE
    RAISE NOTICE '⚠️  Some triggers missing (% triggers)', triggers_count;
  END IF;

  -- Check functions
  SELECT COUNT(*) INTO functions_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND (routine_name LIKE '%audit%'
      OR routine_name LIKE '%updated_by%'
      OR routine_name LIKE '%soft_delete%'
      OR routine_name LIKE '%restore%');

  IF functions_count >= 4 THEN
    RAISE NOTICE '✅ All functions created (% functions)', functions_count;
  ELSE
    RAISE NOTICE '⚠️  Some functions missing (% functions)', functions_count;
  END IF;

  -- Check views
  SELECT COUNT(*) INTO views_count
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND (table_name LIKE '%audit%'
      OR table_name LIKE '%transaction%');

  IF views_count >= 3 THEN
    RAISE NOTICE '✅ All views created (% views)', views_count;
  ELSE
    RAISE NOTICE '⚠️  Some views missing (% views)', views_count;
  END IF;

  -- Check policies
  SELECT COUNT(*) INTO policies_count
  FROM pg_policies
  WHERE tablename IN ('audit_log', 'transactions');

  IF policies_count >= 6 THEN
    RAISE NOTICE '✅ All RLS policies created (% policies)', policies_count;
  ELSE
    RAISE NOTICE '⚠️  Some policies missing (% policies)', policies_count;
  END IF;

  -- Check indexes
  SELECT COUNT(*) INTO indexes_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND (indexname LIKE '%audit%'
      OR indexname LIKE '%deleted%'
      OR indexname LIKE '%active%');

  IF indexes_count >= 6 THEN
    RAISE NOTICE '✅ All indexes created (% indexes)', indexes_count;
  ELSE
    RAISE NOTICE '⚠️  Some indexes missing (% indexes)', indexes_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=== NEXT STEPS ===';
  RAISE NOTICE '1. Create or update a transaction in the app';
  RAISE NOTICE '2. Check audit log: SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT 5;';
  RAISE NOTICE '3. Check "Riwayat Perubahan" in transaction detail modal';
END $$;
