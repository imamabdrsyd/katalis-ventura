-- ============================================
-- Migration 013: Allow users to leave a business
-- Adds RLS policy so users can delete their own role from user_business_roles
-- ============================================

-- Allow users to delete their own membership (leave a business)
CREATE POLICY "Users can leave business"
  ON user_business_roles
  FOR DELETE
  USING (user_id = auth.uid());
