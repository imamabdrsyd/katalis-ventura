-- Migration: 022_invoices.sql
-- Fitur invoice untuk bisnis

-- 1. Add invoice_settings to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS invoice_settings JSONB DEFAULT NULL;

-- 2. Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_id_label TEXT,
  description TEXT,
  item_label TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_type TEXT NOT NULL DEFAULT 'none' CHECK (tax_type IN ('included', 'excluded', 'none')),
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'draft' CHECK (payment_status IN ('draft', 'unpaid', 'paid', 'overdue')),
  notes TEXT,
  meta JSONB,
  transaction_id UUID REFERENCES transactions(id),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  UNIQUE(business_id, invoice_number)
);

-- 3. Create invoice_line_items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX idx_invoices_business_id ON invoices(business_id);
CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);

-- 5. Triggers for updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_line_items_updated_at
  BEFORE UPDATE ON invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Audit trail trigger for invoices
CREATE TRIGGER log_invoices_audit
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- 7. RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Users can view invoices for their businesses
CREATE POLICY "Users can view business invoices"
  ON invoices FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

-- Managers can insert invoices
CREATE POLICY "Managers can create invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = invoices.business_id
        AND role IN ('business_manager', 'both')
    )
  );

-- Managers can update invoices
CREATE POLICY "Managers can update invoices"
  ON invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = invoices.business_id
        AND role IN ('business_manager', 'both')
    )
  );

-- Managers can delete invoices
CREATE POLICY "Managers can delete invoices"
  ON invoices FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = invoices.business_id
        AND role IN ('business_manager', 'both')
    )
  );

-- Line items inherit access from parent invoice
CREATE POLICY "Users can view invoice line items"
  ON invoice_line_items FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE business_id IN (SELECT get_my_business_ids())
    )
  );

CREATE POLICY "Managers can manage invoice line items"
  ON invoice_line_items FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE business_id IN (
        SELECT business_id FROM user_business_roles
        WHERE user_id = auth.uid() AND role IN ('business_manager', 'both')
      )
    )
  );

-- View for active invoices (not soft-deleted)
CREATE OR REPLACE VIEW active_invoices AS
SELECT * FROM invoices WHERE deleted_at IS NULL;
