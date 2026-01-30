-- Katalis Ventura Database Schema
-- This SQL should be run in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- 1. BUSINESSES TABLE
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name TEXT NOT NULL,
    business_type TEXT DEFAULT 'short_term_rental',
    capital_investment NUMERIC DEFAULT 0,
    property_address TEXT,
    property_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. USER_BUSINESS_ROLES TABLE (Junction table for many-to-many)
CREATE TABLE IF NOT EXISTS user_business_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('business_manager', 'investor', 'both')) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id, business_id)
);

-- 3. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    category TEXT CHECK (category IN ('EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN')) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    account TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. INVESTOR_METRICS TABLE
CREATE TABLE IF NOT EXISTS investor_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    investor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_formula JSONB NOT NULL,
    target_value NUMERIC,
    alert_threshold NUMERIC,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(investor_id, business_id, metric_name)
);

-- 5. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    default_role TEXT CHECK (default_role IN ('business_manager', 'investor', 'both')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. INVITE_CODES TABLE
CREATE TABLE IF NOT EXISTS invite_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('business_manager', 'investor')) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_transactions_business_date 
    ON transactions(business_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_category 
    ON transactions(category);

CREATE INDEX IF NOT EXISTS idx_user_business_roles_user 
    ON user_business_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_business_roles_business 
    ON user_business_roles(business_id);

CREATE INDEX IF NOT EXISTS idx_investor_metrics_investor 
    ON investor_metrics(investor_id);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code 
    ON invite_codes(code);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_businesses_updated_at 
    BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investor_metrics_updated_at 
    BEFORE UPDATE ON investor_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_business_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- BUSINESSES POLICIES
CREATE POLICY "Users can view their businesses"
    ON businesses FOR SELECT
    USING (
        id IN (
            SELECT business_id FROM user_business_roles
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Business creators can update"
    ON businesses FOR UPDATE
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Authenticated users can create businesses"
    ON businesses FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- TRANSACTIONS POLICIES
CREATE POLICY "Managers can manage transactions"
    ON transactions FOR ALL
    USING (
        business_id IN (
            SELECT business_id FROM user_business_roles
            WHERE user_id = auth.uid()
            AND role IN ('business_manager', 'both')
        )
    );

CREATE POLICY "Investors can view transactions"
    ON transactions FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM user_business_roles
            WHERE user_id = auth.uid()
            AND role IN ('investor', 'both')
        )
    );

-- USER_BUSINESS_ROLES POLICIES
CREATE POLICY "Users can view their own roles"
    ON user_business_roles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Business managers can invite users"
    ON user_business_roles FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM user_business_roles
            WHERE user_id = auth.uid()
            AND role IN ('business_manager', 'both')
        )
    );

-- INVESTOR_METRICS POLICIES
CREATE POLICY "Investors can manage their own metrics"
    ON investor_metrics FOR ALL
    USING (investor_id = auth.uid());

-- PROFILES POLICIES
CREATE POLICY "Users can view all profiles"
    ON profiles FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- INVITE_CODES POLICIES
CREATE POLICY "Users can view active invite codes"
    ON invite_codes FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "Business managers can create invite codes"
    ON invite_codes FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM user_business_roles
            WHERE user_id = auth.uid()
            AND role IN ('business_manager', 'both')
        )
    );

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Uncomment below to insert sample data
/*
-- Sample business (you'll need to replace with actual user_id)
INSERT INTO businesses (business_name, business_type, capital_investment, property_address, created_by)
VALUES (
    'Katalis Studio',
    'short_term_rental',
    350000000,
    'Galeri Ciumbuleuit Apartment 2, Bandung, West Java',
    'YOUR_USER_ID_HERE'
);

-- Sample transactions (replace business_id with actual id)
INSERT INTO transactions (business_id, date, category, description, amount, account, created_by)
VALUES
    ('YOUR_BUSINESS_ID', '2025-01-02', 'EARN', '4 nights/Laras Dipa', 1312005, 'BCA', 'YOUR_USER_ID'),
    ('YOUR_BUSINESS_ID', '2025-01-04', 'FIN', 'Owners Withdrawal', 811597, 'Cash', 'YOUR_USER_ID');
*/
