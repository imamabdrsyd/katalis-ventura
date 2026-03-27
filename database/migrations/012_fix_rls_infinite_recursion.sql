-- ============================================
-- Migration 011: Fix infinite recursion in user_business_roles RLS
-- The previous policy (010) caused infinite recursion by querying
-- user_business_roles from within its own SELECT policy.
-- Solution: use SECURITY DEFINER functions to break the cycle.
-- ============================================

-- 1. Drop semua policy yang bermasalah
DROP POLICY IF EXISTS "Users can view roles in their businesses" ON user_business_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_business_roles;
DROP POLICY IF EXISTS "Business managers can invite users" ON user_business_roles;

-- 2. Buat SECURITY DEFINER functions (bypass RLS, tidak ada recursion)

-- Returns all business_ids the current user belongs to or created
CREATE OR REPLACE FUNCTION get_my_business_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT business_id
  FROM user_business_roles
  WHERE user_id = auth.uid()
  UNION
  SELECT id
  FROM businesses
  WHERE created_by = auth.uid();
$$;

-- Returns true if current user is a manager or creator of the given business
CREATE OR REPLACE FUNCTION is_business_manager(bid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_business_roles
    WHERE user_id = auth.uid()
    AND business_id = bid
    AND role IN ('business_manager', 'both')
  )
  OR EXISTS (
    SELECT 1 FROM businesses
    WHERE id = bid AND created_by = auth.uid()
  );
$$;

-- 3. Recreate semua policy pakai function (no recursion)
CREATE POLICY "Users can view roles in their businesses"
  ON user_business_roles FOR SELECT
  USING (
    business_id IN (SELECT get_my_business_ids())
  );

CREATE POLICY "Business managers can insert roles"
  ON user_business_roles FOR INSERT
  WITH CHECK (
    is_business_manager(business_id)
  );
