-- Migration 028: Add Period Locking to businesses
-- Prevents editing/deleting transactions on or before the closed_until_date

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS closed_until_date DATE DEFAULT NULL;

COMMENT ON COLUMN businesses.closed_until_date IS
  'Transaksi dengan tanggal <= closed_until_date tidak dapat diedit atau dihapus (period lock).';
