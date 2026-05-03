-- Migration 060: Tambah penanda is_dividend pada tabel accounts
-- Memungkinkan user secara eksplisit menandai akun EQUITY mana yang merupakan
-- "Dividen / Prive / Drawing" (penarikan pemilik) dan menandai akun LIABILITY
-- mana yang merupakan "Hutang Dividen" (declared but unpaid dividends).
--
-- Tujuan: Mengganti string-matching nama akun yang fragile (mencari kata
-- "dividen", "prive", "drawing") dengan penanda semantik yang persistent.

-- Step 1: Tambah dua kolom boolean
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS is_dividend BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_dividend_payable BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN accounts.is_dividend IS
  'Menandai akun EQUITY ini sebagai akun Dividen / Prive / Penarikan Pemilik. Saat dipilih di transaksi, sistem menawarkan mode Declare (vs Hutang Dividen) atau Cashout (vs Kas/Bank).';

COMMENT ON COLUMN accounts.is_dividend_payable IS
  'Menandai akun LIABILITY ini sebagai akun Hutang Dividen — tujuan kredit otomatis saat dividen di-declare. Hanya satu akun per bisnis yang boleh bernilai TRUE.';

-- Step 2: Partial unique index untuk is_dividend_payable
-- Hanya satu akun Hutang Dividen aktif per bisnis.
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_one_dividend_payable_per_business
  ON accounts (business_id)
  WHERE is_dividend_payable = TRUE;

-- Step 3: Backfill is_dividend untuk akun EQUITY existing yang nama-nya
-- mengandung kata kunci dividen/prive/drawing/dividend.
UPDATE accounts
  SET is_dividend = TRUE
WHERE account_type = 'EQUITY'
  AND is_active = TRUE
  AND is_dividend = FALSE
  AND (
    LOWER(account_name) LIKE '%dividen%'
    OR LOWER(account_name) LIKE '%prive%'
    OR LOWER(account_name) LIKE '%drawing%'
    OR LOWER(account_name) LIKE '%dividend%'
  );

-- Step 4: Backfill is_dividend_payable untuk akun LIABILITY existing yang
-- nama-nya jelas "Hutang Dividen" / "Dividend Payable".
UPDATE accounts
  SET is_dividend_payable = TRUE
WHERE account_type = 'LIABILITY'
  AND is_active = TRUE
  AND is_dividend_payable = FALSE
  AND (
    LOWER(account_name) LIKE '%hutang dividen%'
    OR LOWER(account_name) LIKE '%utang dividen%'
    OR LOWER(account_name) LIKE '%dividend payable%'
  );

SELECT 'Migration 060 complete - is_dividend & is_dividend_payable columns added and backfilled' as status;
