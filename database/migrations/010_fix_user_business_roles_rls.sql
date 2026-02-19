-- ============================================
-- Migration 010: Fix user_business_roles RLS
-- Business creators and managers can see all members of their businesses
-- ============================================

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own roles" ON user_business_roles;

-- New policy: users can see all roles in businesses they belong to OR created
CREATE POLICY "Users can view roles in their businesses"
  ON user_business_roles FOR SELECT
  USING (
    -- Can see their own role
    user_id = auth.uid()
    OR
    -- Can see all roles in businesses they are a member of
    business_id IN (
      SELECT business_id FROM user_business_roles
      WHERE user_id = auth.uid()
    )
    OR
    -- Business creator can see all roles
    business_id IN (
      SELECT id FROM businesses
      WHERE created_by = auth.uid()
    )
  );
