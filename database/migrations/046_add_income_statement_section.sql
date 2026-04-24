-- Migration 046: Tambah kolom income_statement_section di accounts
-- Kolom ini memungkinkan user override klasifikasi default di Income Statement:
--   - 'cost_of_revenue' → akun muncul di Cost of Revenue section
--   - 'operating_expense' → akun muncul di Operating Expenses section
--   - NULL → pakai default logic (default_category === 'VAR' → COGS, else OPEX)
--
-- Hanya akun EXPENSE yang diperbolehkan memiliki nilai non-NULL.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS income_statement_section TEXT
  CHECK (income_statement_section IN ('cost_of_revenue', 'operating_expense'));

COMMENT ON COLUMN accounts.income_statement_section IS
  'Override klasifikasi Income Statement (hanya untuk EXPENSE account). NULL = default logic.';
