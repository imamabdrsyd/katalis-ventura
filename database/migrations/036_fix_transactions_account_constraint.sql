-- ============================================================
-- 036_fix_transactions_account_constraint.sql
-- Replace weak check_different_accounts constraint with
-- context-aware rules per transaction type:
--   - is_multi_line=true  → debit/credit account MUST be NULL
--   - is_double_entry=true → debit/credit account MUST be set and different
--   - legacy (both false) → NULL allowed (backward compat)
-- ============================================================

-- Pre-check 1: Multi-line yang masih punya account_id (harus NULL-kan dulu)
-- SELECT id, is_multi_line, debit_account_id, credit_account_id
-- FROM transactions
-- WHERE is_multi_line = true
--   AND (debit_account_id IS NOT NULL OR credit_account_id IS NOT NULL);

-- Pre-check 2: Double-entry yang missing account (harus fix dulu)
-- SELECT id, is_double_entry, debit_account_id, credit_account_id
-- FROM transactions
-- WHERE is_double_entry = true
--   AND (debit_account_id IS NULL OR credit_account_id IS NULL);

-- Jika ada hasil dari pre-check, JANGAN apply migration. Fix data dulu.

-- DATA FIX jika ada multi-line transactions yang masih punya account_id:
-- UPDATE transactions
-- SET debit_account_id = NULL, credit_account_id = NULL
-- WHERE is_multi_line = true
--   AND (debit_account_id IS NOT NULL OR credit_account_id IS NOT NULL);

-- 1. Drop constraint lama
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS check_different_accounts;

-- 2. Add constraint baru yang context-aware per tipe transaksi
ALTER TABLE transactions
  ADD CONSTRAINT transactions_account_rules CHECK (
    CASE
      -- Multi-line: akun header tidak dipakai, journal_lines yang pegang
      WHEN is_multi_line = true THEN
        debit_account_id IS NULL AND credit_account_id IS NULL

      -- Double-entry: kedua akun WAJIB ada dan BERBEDA
      WHEN is_double_entry = true THEN
        debit_account_id IS NOT NULL
        AND credit_account_id IS NOT NULL
        AND debit_account_id != credit_account_id

      -- Legacy: boleh NULL (backward compatibility)
      ELSE true
    END
  );

-- ============================================================
-- ROLLBACK (jalankan manual jika perlu revert):
-- ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_rules;
-- ALTER TABLE transactions ADD CONSTRAINT check_different_accounts CHECK (
--   debit_account_id IS NULL OR credit_account_id IS NULL
--   OR debit_account_id != credit_account_id
-- );
-- ============================================================
