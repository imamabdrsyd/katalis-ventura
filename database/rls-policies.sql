-- ============================================
-- RLS POLICIES FOR PROFILES TABLE
-- ============================================

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all profiles (untuk business creator info)
CREATE POLICY "profiles_read_public" ON profiles
  FOR SELECT
  USING (true);

-- Policy: Users can update their own profile
CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "profiles_insert_self" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- RLS POLICIES FOR BUSINESSES TABLE
-- ============================================

-- Enable RLS on businesses table
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read businesses they're part of
CREATE POLICY "businesses_read" ON businesses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = businesses.id
      AND user_business_roles.user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

-- Policy: Only creator can update
CREATE POLICY "businesses_update" ON businesses
  FOR UPDATE
  USING (created_by = auth.uid());

-- Policy: Only creator can delete
CREATE POLICY "businesses_delete" ON businesses
  FOR DELETE
  USING (created_by = auth.uid());

-- Policy: Business managers and both can insert
CREATE POLICY "businesses_insert" ON businesses
  FOR INSERT
  WITH CHECK (created_by = auth.uid());
