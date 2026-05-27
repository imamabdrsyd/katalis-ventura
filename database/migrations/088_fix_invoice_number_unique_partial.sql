-- Migration 088: Ganti UNIQUE constraint invoice_number ke partial index
-- agar nomor invoice yang sudah soft-deleted bisa dipakai ulang.
--
-- Sebelumnya: UNIQUE(business_id, invoice_number) mencakup semua rows
-- termasuk yang sudah dihapus (deleted_at IS NOT NULL), sehingga nomor
-- bekas invoice yang dihapus tidak bisa dipakai lagi → error duplicate key.
--
-- Sesudah: partial unique index hanya enforce keunikan pada rows aktif
-- (deleted_at IS NULL). Nomor invoice yang sudah dihapus bebas dipakai ulang.

-- Drop constraint lama
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_business_id_invoice_number_key;

-- Partial unique index — hanya berlaku untuk invoice yang belum dihapus
CREATE UNIQUE INDEX IF NOT EXISTS invoices_business_id_invoice_number_active_uq
  ON invoices (business_id, invoice_number)
  WHERE deleted_at IS NULL;

-- ROLLBACK:
--   DROP INDEX IF EXISTS invoices_business_id_invoice_number_active_uq;
--   ALTER TABLE invoices ADD CONSTRAINT invoices_business_id_invoice_number_key
--     UNIQUE (business_id, invoice_number);
