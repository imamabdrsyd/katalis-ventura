-- Migration: Add meta (jsonb) column to transactions
-- Created: 2026-02-19
-- Description: Adds a flexible meta column for storing structured metadata
--              like related stock transaction IDs, matching principle info, etc.

-- ============================================================================
-- 1. ADD META COLUMN
-- ============================================================================

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN transactions.meta IS 'Flexible metadata storage (jsonb). Used for: sold_stock_ids (array of transaction IDs when inventory is sold), and other structured metadata.';

-- ============================================================================
-- 2. CREATE INDEX FOR JSONB QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transactions_meta
ON transactions USING GIN (meta) WHERE meta IS NOT NULL;
