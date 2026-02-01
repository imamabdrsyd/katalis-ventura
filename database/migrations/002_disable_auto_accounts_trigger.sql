-- Migration: Disable automatic account creation trigger
-- Created: 2025-02-02
-- Description: Removes the trigger that auto-creates accounts on business insert
--              to prevent RLS conflicts. Accounts will be created manually after
--              user role is assigned.

-- ============================================================================
-- DISABLE AUTOMATIC ACCOUNT CREATION TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS business_create_accounts ON businesses;

-- Note: The trigger function is kept for manual use via RPC call
-- The create_default_accounts(p_business_id UUID) function remains available

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Migration 002 complete - Auto accounts trigger disabled' as status;
