-- Monitor database storage usage for audit trail and other tables
-- Run this periodically to track growth and plan maintenance

-- ============================================================================
-- Overall Database Size
-- ============================================================================

SELECT
  pg_size_pretty(pg_database_size(current_database())) as total_database_size;

-- ============================================================================
-- Table Sizes with Row Counts
-- ============================================================================

SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size,
  (SELECT COUNT(*) FROM audit_log) as row_count
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('audit_log', 'transactions', 'businesses', 'accounts', 'profiles')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- Audit Log Growth Analysis
-- ============================================================================

SELECT
  'Total audit logs' as metric,
  COUNT(*)::text as value
FROM audit_log

UNION ALL

SELECT
  'Logs last 7 days',
  COUNT(*)::text
FROM audit_log
WHERE changed_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT
  'Logs last 30 days',
  COUNT(*)::text
FROM audit_log
WHERE changed_at > NOW() - INTERVAL '30 days'

UNION ALL

SELECT
  'Logs last 1 year',
  COUNT(*)::text
FROM audit_log
WHERE changed_at > NOW() - INTERVAL '1 year'

UNION ALL

SELECT
  'Logs older than 2 years',
  COUNT(*)::text
FROM audit_log
WHERE changed_at < NOW() - INTERVAL '2 years'

UNION ALL

SELECT
  'Estimated size (MB)',
  ROUND((COUNT(*) * 1.5 / 1024)::numeric, 2)::text
FROM audit_log;

-- ============================================================================
-- Audit Log Operations Breakdown
-- ============================================================================

SELECT
  operation,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM audit_log
GROUP BY operation
ORDER BY count DESC;

-- ============================================================================
-- Most Audited Tables
-- ============================================================================

SELECT
  table_name,
  COUNT(*) as audit_entries,
  MIN(changed_at) as first_entry,
  MAX(changed_at) as last_entry
FROM audit_log
GROUP BY table_name
ORDER BY audit_entries DESC;

-- ============================================================================
-- Most Active Users (by changes)
-- ============================================================================

SELECT
  p.full_name,
  COUNT(*) as changes_made,
  MAX(al.changed_at) as last_activity
FROM audit_log al
LEFT JOIN profiles p ON al.changed_by = p.id
WHERE al.changed_by IS NOT NULL
GROUP BY p.full_name
ORDER BY changes_made DESC
LIMIT 10;

-- ============================================================================
-- Storage Growth Projection
-- ============================================================================

WITH monthly_growth AS (
  SELECT
    DATE_TRUNC('month', changed_at) as month,
    COUNT(*) as entries,
    COUNT(*) * 1.5 / 1024 as estimated_mb
  FROM audit_log
  WHERE changed_at > NOW() - INTERVAL '6 months'
  GROUP BY DATE_TRUNC('month', changed_at)
  ORDER BY month DESC
)
SELECT
  month,
  entries,
  ROUND(estimated_mb::numeric, 2) as mb_added,
  ROUND(SUM(estimated_mb) OVER (ORDER BY month)::numeric, 2) as cumulative_mb
FROM monthly_growth;

-- ============================================================================
-- Recommendations
-- ============================================================================

DO $$
DECLARE
  total_logs BIGINT;
  old_logs BIGINT;
  storage_mb NUMERIC;
BEGIN
  SELECT COUNT(*) INTO total_logs FROM audit_log;
  SELECT COUNT(*) INTO old_logs FROM audit_log WHERE changed_at < NOW() - INTERVAL '2 years';
  SELECT ROUND((total_logs * 1.5 / 1024)::numeric, 2) INTO storage_mb;

  RAISE NOTICE '=== AUDIT TRAIL STORAGE REPORT ===';
  RAISE NOTICE 'Total audit logs: %', total_logs;
  RAISE NOTICE 'Estimated storage: % MB', storage_mb;
  RAISE NOTICE 'Logs older than 2 years: %', old_logs;
  RAISE NOTICE '';

  IF storage_mb > 100 THEN
    RAISE NOTICE '⚠️  WARNING: Audit log storage exceeds 100 MB';
    RAISE NOTICE '📋 RECOMMENDATION: Consider archiving old logs';
    IF old_logs > 0 THEN
      RAISE NOTICE '    - % logs can be archived (older than 2 years)', old_logs;
      RAISE NOTICE '    - Run: database/maintenance/archive_old_audit_logs.sql';
    END IF;
  ELSIF storage_mb > 50 THEN
    RAISE NOTICE '⚡ INFO: Audit log storage is moderate (% MB)', storage_mb;
    RAISE NOTICE '📋 RECOMMENDATION: Plan for archiving in the next 6 months';
  ELSE
    RAISE NOTICE '✅ OK: Audit log storage is healthy (% MB)', storage_mb;
    RAISE NOTICE '📋 No action needed at this time';
  END IF;

  IF total_logs > 100000 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚡ INFO: Large number of audit logs detected';
    RAISE NOTICE '📋 RECOMMENDATION: Consider table partitioning';
    RAISE NOTICE '    - Run: database/maintenance/partition_audit_log.sql';
  END IF;
END $$;
