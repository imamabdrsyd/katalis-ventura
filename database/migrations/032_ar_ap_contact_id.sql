-- Migration: 029_ar_ap_contact_id.sql
-- Tambah contact_id FK ke transactions dan invoices untuk AR/AP tracking

-- 1. Tambah contact_id ke transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES business_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_contact_id ON transactions(contact_id);

-- 2. Tambah contact_id ke invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES business_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices(contact_id);

-- 3. Backfill: link transactions ke contacts berdasarkan name (case-insensitive)
-- Ini opsional dan berjalan best-effort (tidak gagal jika tidak match)
UPDATE transactions t
SET contact_id = bc.id
FROM business_contacts bc
WHERE t.business_id = bc.business_id
  AND t.contact_id IS NULL
  AND t.deleted_at IS NULL
  AND LOWER(t.name) = LOWER(bc.name);

-- 4. Backfill: link invoices ke contacts berdasarkan customer_name
UPDATE invoices i
SET contact_id = bc.id
FROM business_contacts bc
WHERE i.business_id = bc.business_id
  AND i.contact_id IS NULL
  AND i.deleted_at IS NULL
  AND LOWER(i.customer_name) = LOWER(bc.name);
