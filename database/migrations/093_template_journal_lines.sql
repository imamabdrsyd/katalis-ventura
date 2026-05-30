-- Migration 085: Multi-line journal support for transaction templates
-- Memungkinkan template menyimpan jurnal multi-baris penuh (akun + debit/kredit + keterangan per baris)
-- Backward-compatible: template single-line lama tetap pakai debit_account_id/credit_account_id/default_amount,
-- kolom journal_lines NULL untuk template lama.

ALTER TABLE transaction_templates
  ADD COLUMN IF NOT EXISTS journal_lines JSONB;

COMMENT ON COLUMN transaction_templates.journal_lines IS
  'Multi-line journal template. Array of { account_id, debit_amount, credit_amount, description, sort_order }. NULL untuk template single-line.';
