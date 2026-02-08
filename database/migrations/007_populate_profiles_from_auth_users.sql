-- Migration: Populate profiles table with user data from auth.users
-- Created: 2026-02-08
-- Description: Ensure all auth.users have corresponding profiles with full_name populated
-- FIXED: Removed email column reference (doesn't exist in profiles table)

-- ============================================================================
-- FIRST: Check profiles table structure
-- ============================================================================

-- Check what columns exist in profiles
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- ============================================================================
-- PART 1: INSERT MISSING PROFILES (only id and full_name)
-- ============================================================================

-- Insert profiles for all auth.users that don't have profiles yet
INSERT INTO profiles (id, full_name, updated_at)
SELECT
  id,
  COALESCE(
    raw_user_meta_data->>'full_name',
    email,
    'User'
  ) as full_name,
  NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 2: UPDATE EXISTING PROFILES WITH MISSING full_name
-- ============================================================================

-- Update profiles where full_name is NULL using auth.users data
UPDATE profiles p
SET
  full_name = COALESCE(
    (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p.id),
    (SELECT email FROM auth.users WHERE id = p.id),
    'User'
  ),
  updated_at = NOW()
WHERE p.full_name IS NULL OR p.full_name = '';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check profiles table status
SELECT
  'Profiles table status' as status,
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN full_name IS NOT NULL AND full_name != '' THEN 1 END) as with_full_name,
  COUNT(CASE WHEN full_name IS NULL OR full_name = '' THEN 1 END) as missing_full_name
FROM profiles;

-- Check if all businesses now have creators with profiles
SELECT
  'Business creators status' as status,
  COUNT(*) as total_businesses,
  COUNT(CASE WHEN b.created_by IS NOT NULL THEN 1 END) as with_creator,
  COUNT(CASE
    WHEN b.created_by IS NOT NULL
    AND p.id IS NOT NULL
    AND p.full_name IS NOT NULL
    AND p.full_name != ''
    THEN 1
  END) as with_creator_and_profile
FROM businesses b
LEFT JOIN profiles p ON b.created_by = p.id;

-- Show sample of businesses with creator info
SELECT
  b.business_name,
  b.created_by,
  COALESCE(p.full_name, 'Unknown') as creator_name
FROM businesses b
LEFT JOIN profiles p ON b.created_by = p.id
ORDER BY b.created_at DESC
LIMIT 10;
