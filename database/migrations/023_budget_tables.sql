-- Migration: 023_budget_tables.sql
-- Fitur Budget & Forecast untuk perencanaan keuangan

-- 1. Create budgets table (header periode budget)
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'locked')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, name)
);

-- 2. Create budget_lines table (target per akun per bulan)
CREATE TABLE IF NOT EXISTS budget_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(budget_id, account_id, month)
);

-- 3. Indexes
CREATE INDEX idx_budgets_business_id ON budgets(business_id);
CREATE INDEX idx_budgets_status ON budgets(status);
CREATE INDEX idx_budget_lines_budget_id ON budget_lines(budget_id);
CREATE INDEX idx_budget_lines_account_id ON budget_lines(account_id);
CREATE INDEX idx_budget_lines_month ON budget_lines(month);

-- 4. Triggers for updated_at (reuse existing function)
CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_lines_updated_at
  BEFORE UPDATE ON budget_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Audit trail trigger
CREATE TRIGGER log_budgets_audit
  AFTER INSERT OR UPDATE OR DELETE ON budgets
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- 6. RLS
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;

-- Users can view budgets for their businesses
CREATE POLICY "Users can view business budgets"
  ON budgets FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

-- Managers can create budgets
CREATE POLICY "Managers can create budgets"
  ON budgets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = budgets.business_id
        AND role IN ('business_manager', 'both')
    )
  );

-- Managers can update non-locked budgets
CREATE POLICY "Managers can update budgets"
  ON budgets FOR UPDATE
  USING (
    status != 'locked'
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = budgets.business_id
        AND role IN ('business_manager', 'both')
    )
  );

-- Managers can delete draft budgets
CREATE POLICY "Managers can delete draft budgets"
  ON budgets FOR DELETE
  USING (
    status = 'draft'
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = budgets.business_id
        AND role IN ('business_manager', 'both')
    )
  );

-- Budget lines: users can view via parent budget
CREATE POLICY "Users can view budget lines"
  ON budget_lines FOR SELECT
  USING (
    budget_id IN (
      SELECT id FROM budgets
      WHERE business_id IN (SELECT get_my_business_ids())
    )
  );

-- Budget lines: managers can manage (non-locked budgets)
CREATE POLICY "Managers can manage budget lines"
  ON budget_lines FOR ALL
  USING (
    budget_id IN (
      SELECT id FROM budgets
      WHERE status != 'locked'
        AND business_id IN (
          SELECT business_id FROM user_business_roles
          WHERE user_id = auth.uid() AND role IN ('business_manager', 'both')
        )
    )
  );

-- 7. Superadmin policies (full access, same pattern as 018_add_superadmin_role.sql)
CREATE POLICY "superadmin_manage_all_budgets"
  ON budgets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.default_role = 'superadmin'
    )
  );

CREATE POLICY "superadmin_manage_all_budget_lines"
  ON budget_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.default_role = 'superadmin'
    )
  );
