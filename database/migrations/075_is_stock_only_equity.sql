-- Migration 075: Enforce is_stock hanya untuk akun EQUITY
-- Konteks: flag is_stock menandai akun modal disetor pemilik/investor (share capital).
-- Sebelum constraint ini, akun ASSET/LIABILITY/REVENUE/EXPENSE bisa salah di-flag
-- sebagai is_stock dan menyebabkan ROI/invested capital calculation kacau.

-- Reset semua flag is_stock yang salah lokasi sebelum tambah constraint
UPDATE accounts
SET is_stock = false
WHERE is_stock = true
  AND account_type <> 'EQUITY';

ALTER TABLE accounts
  ADD CONSTRAINT is_stock_only_for_equity
  CHECK (is_stock = false OR account_type = 'EQUITY');

COMMENT ON COLUMN accounts.is_stock IS
  'Tandai akun ini sebagai share capital (modal disetor pemilik/investor). Hanya valid untuk account_type=EQUITY.';
