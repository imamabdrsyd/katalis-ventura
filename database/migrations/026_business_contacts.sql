-- Migration: business_contacts
-- Tabel untuk menyimpan daftar kontak (customer/vendor) per bisnis

CREATE TABLE IF NOT EXISTS business_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('customer', 'vendor', 'other')),
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk query per bisnis + pencarian nama
CREATE INDEX idx_business_contacts_business_id ON business_contacts(business_id);
CREATE INDEX idx_business_contacts_name ON business_contacts(business_id, name);

-- Unique constraint: nama kontak unik per bisnis
CREATE UNIQUE INDEX idx_business_contacts_unique_name ON business_contacts(business_id, LOWER(name));

-- Auto-update updated_at
CREATE TRIGGER update_business_contacts_updated_at
  BEFORE UPDATE ON business_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE business_contacts ENABLE ROW LEVEL SECURITY;

-- Policy: user bisa lihat kontak bisnis yang dia ikuti
CREATE POLICY "Users can view contacts of their businesses"
  ON business_contacts FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

-- Policy: business_manager/both bisa insert
CREATE POLICY "Managers can insert contacts"
  ON business_contacts FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = business_contacts.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- Policy: business_manager/both bisa update
CREATE POLICY "Managers can update contacts"
  ON business_contacts FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = business_contacts.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- Policy: business_manager/both bisa delete
CREATE POLICY "Managers can delete contacts"
  ON business_contacts FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = business_contacts.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );
