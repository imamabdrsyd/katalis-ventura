-- Archive old audit logs to reduce database size
-- Run this script annually or when audit_log table becomes too large

-- ============================================================================
-- OPTION 1: Archive to separate table (recommended)
-- ============================================================================

-- Create archive table (if not exists)
CREATE TABLE IF NOT EXISTS audit_log_archive (
  LIKE audit_log INCLUDING ALL
);

-- Move logs older than 2 years to archive
WITH moved_logs AS (
  DELETE FROM audit_log
  WHERE changed_at < NOW() - INTERVAL '2 years'
  RETURNING *
)
INSERT INTO audit_log_archive
SELECT * FROM moved_logs;

-- Verify counts
SELECT
  'audit_log' as table_name,
  COUNT(*) as record_count,
  pg_size_pretty(pg_total_relation_size('audit_log')) as table_size
FROM audit_log
UNION ALL
SELECT
  'audit_log_archive' as table_name,
  COUNT(*) as record_count,
  pg_size_pretty(pg_total_relation_size('audit_log_archive')) as table_size
FROM audit_log_archive;

-- ============================================================================
-- OPTION 2: Hard delete (not recommended for compliance)
-- ============================================================================

-- Only use if you don't need historical audit data
-- DELETE FROM audit_log WHERE changed_at < NOW() - INTERVAL '2 years';

-- ============================================================================
-- OPTION 3: Export to external storage then delete
-- ============================================================================

-- 1. Export to CSV (run this first)
-- COPY (
--   SELECT * FROM audit_log
--   WHERE changed_at < NOW() - INTERVAL '2 years'
-- ) TO '/tmp/audit_log_archive_2024.csv' CSV HEADER;

-- 2. Then delete (after verifying export)
-- DELETE FROM audit_log WHERE changed_at < NOW() - INTERVAL '2 years';

COMMENT ON TABLE audit_log_archive IS 'Archived audit logs older than 2 years';
