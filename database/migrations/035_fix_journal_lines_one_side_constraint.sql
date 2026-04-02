-- ============================================================
-- 035_fix_journal_lines_one_side_constraint.sql
-- Hapus inline CHECK (>= 0) yang redundan pada journal_lines.
-- Constraint journal_line_one_side_nonzero sudah memastikan
-- tepat satu sisi > 0 dan sisi lain = 0, sehingga >= 0 tersirat.
-- ============================================================

-- Pre-check: pastikan tidak ada baris yang melanggar constraint
-- SELECT * FROM journal_lines
-- WHERE NOT (
--   (debit_amount > 0 AND credit_amount = 0)
--   OR (debit_amount = 0 AND credit_amount > 0)
-- );
-- Jika ada hasil, fix dulu sebelum apply migration

-- Drop inline CHECK constraints yang redundan.
-- Nama constraint di-generate oleh PostgreSQL dengan format:
--   journal_lines_debit_amount_check
--   journal_lines_credit_amount_check
ALTER TABLE journal_lines
  DROP CONSTRAINT IF EXISTS journal_lines_debit_amount_check;

ALTER TABLE journal_lines
  DROP CONSTRAINT IF EXISTS journal_lines_credit_amount_check;

-- Pastikan constraint utama ada (idempotent).
-- Jika sudah ada dari migration 031, ini akan no-op berkat DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_line_one_side_nonzero'
      AND conrelid = 'journal_lines'::regclass
  ) THEN
    ALTER TABLE journal_lines
      ADD CONSTRAINT journal_line_one_side_nonzero CHECK (
        (debit_amount > 0 AND credit_amount = 0)
        OR (debit_amount = 0 AND credit_amount > 0)
      );
  END IF;
END
$$;
