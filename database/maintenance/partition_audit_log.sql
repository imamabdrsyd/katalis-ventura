-- Partition audit_log table by year for better performance at scale
-- Only needed if you expect > 100,000 audit log entries
-- WARNING: This requires recreating the table, run during maintenance window

-- ============================================================================
-- STEP 1: Create partitioned audit_log table
-- ============================================================================

-- Rename existing table
ALTER TABLE audit_log RENAME TO audit_log_backup;

-- Create new partitioned table
CREATE TABLE audit_log (
  id UUID DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (id, changed_at)
) PARTITION BY RANGE (changed_at);

-- ============================================================================
-- STEP 2: Create partitions for each year
-- ============================================================================

-- 2024 partition
CREATE TABLE audit_log_2024 PARTITION OF audit_log
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- 2025 partition
CREATE TABLE audit_log_2025 PARTITION OF audit_log
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- 2026 partition
CREATE TABLE audit_log_2026 PARTITION OF audit_log
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Add more partitions as needed each year:
-- CREATE TABLE audit_log_2027 PARTITION OF audit_log
--   FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

-- ============================================================================
-- STEP 3: Recreate indexes on partitioned table
-- ============================================================================

CREATE INDEX idx_audit_log_record ON audit_log (table_name, record_id, changed_at DESC);
CREATE INDEX idx_audit_log_changed_at ON audit_log (changed_at DESC);
CREATE INDEX idx_audit_log_business ON audit_log ((metadata->>'business_id'), changed_at DESC);
CREATE INDEX idx_audit_log_changed_by ON audit_log (changed_by);

-- ============================================================================
-- STEP 4: Migrate data from backup
-- ============================================================================

INSERT INTO audit_log SELECT * FROM audit_log_backup;

-- Verify counts match
SELECT
  'audit_log_backup' as table_name,
  COUNT(*) as records
FROM audit_log_backup
UNION ALL
SELECT
  'audit_log (new)' as table_name,
  COUNT(*) as records
FROM audit_log;

-- ============================================================================
-- STEP 5: Recreate RLS policies
-- ============================================================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their businesses"
ON audit_log FOR SELECT
USING (
  (metadata->>'business_id')::uuid IN (
    SELECT business_id FROM user_business_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "No manual insertions to audit log"
ON audit_log FOR INSERT WITH CHECK (false);

CREATE POLICY "Audit logs are immutable"
ON audit_log FOR UPDATE USING (false);

CREATE POLICY "Audit logs cannot be deleted"
ON audit_log FOR DELETE USING (false);

-- ============================================================================
-- STEP 6: Cleanup (only after verifying everything works)
-- ============================================================================

-- DROP TABLE audit_log_backup;

-- ============================================================================
-- STEP 7: Automate partition creation (optional)
-- ============================================================================

-- Function to automatically create next year's partition
CREATE OR REPLACE FUNCTION create_next_audit_log_partition()
RETURNS void AS $$
DECLARE
  next_year INT := EXTRACT(YEAR FROM NOW()) + 1;
  partition_name TEXT := 'audit_log_' || next_year;
  start_date TEXT := next_year || '-01-01';
  end_date TEXT := (next_year + 1) || '-01-01';
BEGIN
  -- Check if partition already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule this function to run annually (via pg_cron or external scheduler)
-- SELECT create_next_audit_log_partition();
