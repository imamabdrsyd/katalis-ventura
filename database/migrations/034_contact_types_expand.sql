-- Tambah tipe kontak: partner, staff, investor
-- Sebelumnya hanya: customer, vendor, other

ALTER TABLE business_contacts
  DROP CONSTRAINT IF EXISTS business_contacts_type_check;

ALTER TABLE business_contacts
  ADD CONSTRAINT business_contacts_type_check
  CHECK (type IN ('customer', 'vendor', 'partner', 'staff', 'investor', 'other'));
