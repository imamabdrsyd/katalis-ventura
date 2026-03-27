-- Migration: Add superadmin role
-- Superadmin can access all businesses and all features

-- 1. Update check constraint on user_business_roles to allow 'superadmin'
ALTER TABLE user_business_roles
  DROP CONSTRAINT IF EXISTS user_business_roles_role_check;

ALTER TABLE user_business_roles
  ADD CONSTRAINT user_business_roles_role_check
  CHECK (role IN ('business_manager', 'investor', 'both', 'superadmin'));

-- 2. Update check constraint on profiles.default_role (if exists)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_default_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_default_role_check
  CHECK (default_role IN ('business_manager', 'investor', 'both', 'superadmin'));

-- 3. Set imam.isyida@gmail.com as superadmin
-- Update profiles.default_role for this user
UPDATE profiles
SET default_role = 'superadmin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'imam.isyida@gmail.com'
);

-- 4. Create RLS policy so superadmin can read all businesses
CREATE POLICY "superadmin_read_all_businesses" ON businesses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.default_role = 'superadmin'
    )
  );

-- 5. Create RLS policy so superadmin can update all businesses
CREATE POLICY "superadmin_update_all_businesses" ON businesses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.default_role = 'superadmin'
    )
  );

-- 6. Create RLS policy so superadmin can read all transactions
CREATE POLICY "superadmin_read_all_transactions" ON transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.default_role = 'superadmin'
    )
  );

-- 7. Create RLS policy so superadmin can manage all transactions
CREATE POLICY "superadmin_manage_all_transactions" ON transactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.default_role = 'superadmin'
    )
  );

-- 8. Create RLS policy so superadmin can read all accounts
CREATE POLICY "superadmin_read_all_accounts" ON accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.default_role = 'superadmin'
    )
  );

-- 9. Create RLS policy so superadmin can manage all accounts
CREATE POLICY "superadmin_manage_all_accounts" ON accounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.default_role = 'superadmin'
    )
  );
