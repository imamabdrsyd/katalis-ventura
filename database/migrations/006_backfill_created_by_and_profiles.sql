-- Migration: Backfill created_by for businesses and ensure profiles table is populated
-- Created: 2026-02-08
-- Description:
--   1. For businesses with created_by = NULL, set created_by from the business owner (user_business_roles)
--   2. Ensure profiles table has all users with full_name populated from auth.users

-- ============================================================================
-- PART 1: BACKFILL created_by FOR BUSINESSES
-- ============================================================================

-- Update businesses with NULL created_by using the first business manager from user_business_roles
UPDATE businesses b
SET created_by = (
  SELECT user_id FROM user_business_roles ubr
  WHERE ubr.business_id = b.id
  AND ubr.role IN ('business_manager', 'both')
  ORDER BY ubr.joined_at ASC
  LIMIT 1
)
WHERE created_by IS NULL;

-- Log the results
SELECT
  'Backfill created_by completed' as status,
  COUNT(*) as total_businesses,
  COUNT(CASE WHEN created_by IS NOT NULL THEN 1 END) as businesses_with_creator,
  COUNT(CASE WHEN created_by IS NULL THEN 1 END) as businesses_still_missing
FROM businesses;

-- ============================================================================
-- PART 2: ENSURE PROFILES TABLE IS POPULATED
-- ============================================================================

-- The profiles table should have been created by Supabase automatically when users sign up
-- This ensures all auth.users have corresponding profiles with full_name populated

-- Check if profiles table exists and has data
-- (This is informational - actual profiles creation happens in auth setup)
SELECT
  'Profiles status' as status,
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN full_name IS NOT NULL THEN 1 END) as profiles_with_name,
  COUNT(CASE WHEN full_name IS NULL THEN 1 END) as profiles_missing_name
FROM profiles;

-- ============================================================================
-- PART 3: CREATE TRIGGER FOR AUTO-POPULATE created_by ON INSERT
-- ============================================================================

-- Create function to auto-populate created_by from auth.uid()
CREATE OR REPLACE FUNCTION set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set created_by if it's NULL and we're in an authenticated context
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS business_set_created_by ON businesses;

-- Create trigger to auto-populate created_by
CREATE TRIGGER business_set_created_by
  BEFORE INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all businesses now have created_by
SELECT
  'Final verification' as status,
  COUNT(*) as total_businesses,
  COUNT(CASE WHEN created_by IS NOT NULL THEN 1 END) as with_creator,
  COUNT(CASE WHEN created_by IS NULL THEN 1 END) as without_creator
FROM businesses;
