-- ============================================================
-- 037_add_journal_lines_balance_trigger.sql
-- Enforce total debit = total credit per transaction_id di level database.
-- Saat ini rule ini hanya di-enforce di Zod + API route handler.
-- Trigger ini menjadi safety net agar direct INSERT/UPDATE/DELETE
-- via SQL editor atau service role tidak bisa menghasilkan jurnal
-- yang tidak balance.
-- ============================================================

-- Pre-check: cari journal entries yang tidak balance
-- SELECT
--   jl.transaction_id,
--   SUM(jl.debit_amount) as total_debit,
--   SUM(jl.credit_amount) as total_credit,
--   ABS(SUM(jl.debit_amount) - SUM(jl.credit_amount)) as diff
-- FROM journal_lines jl
-- JOIN transactions t ON t.id = jl.transaction_id
-- WHERE t.is_multi_line = true
-- GROUP BY jl.transaction_id
-- HAVING ABS(SUM(jl.debit_amount) - SUM(jl.credit_amount)) > 0.01;
-- Jika ada hasil, fix data dulu sebelum apply migration.

-- 1. Trigger function
CREATE OR REPLACE FUNCTION check_journal_lines_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_transaction_id UUID;
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
  v_line_count INTEGER;
  v_is_multi_line BOOLEAN;
BEGIN
  -- Tentukan transaction_id yang terpengaruh
  IF TG_OP = 'DELETE' THEN
    v_transaction_id := OLD.transaction_id;
  ELSE
    v_transaction_id := NEW.transaction_id;
  END IF;

  -- Cek apakah transaksi ini memang multi-line
  SELECT is_multi_line INTO v_is_multi_line
  FROM transactions WHERE id = v_transaction_id;

  -- Hanya enforce untuk multi-line transactions
  IF v_is_multi_line IS NOT TRUE THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Hitung total debit dan credit
  SELECT
    COALESCE(SUM(debit_amount), 0),
    COALESCE(SUM(credit_amount), 0),
    COUNT(*)
  INTO v_total_debit, v_total_credit, v_line_count
  FROM journal_lines
  WHERE transaction_id = v_transaction_id;

  -- Minimal 2 baris
  IF v_line_count < 2 THEN
    RAISE EXCEPTION 'Multi-line journal entry harus memiliki minimal 2 baris (transaction_id: %)',
      v_transaction_id;
  END IF;

  -- Total debit harus = total credit (tolerance 0.01 untuk floating point)
  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry tidak balance: total debit (%) != total credit (%) untuk transaction_id %',
      v_total_debit, v_total_credit, v_transaction_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 2. Constraint trigger (DEFERRABLE INITIALLY DEFERRED)
--
-- CONSTRAINT TRIGGER + DEFERRABLE INITIALLY DEFERRED
--
-- Kenapa bukan BEFORE trigger?
--   → BEFORE trigger per-row tidak bisa lihat baris lain yang belum di-commit
--
-- Kenapa DEFERRABLE?
--   → INSERT multi-line dilakukan dalam satu transaction block:
--     BEGIN; INSERT line 1; INSERT line 2; INSERT line 3; COMMIT;
--     Tanpa DEFERRABLE, trigger fire setelah line 1 → gagal karena belum balance
--     Dengan DEFERRABLE INITIALLY DEFERRED, trigger fire saat COMMIT → semua baris sudah ada
--
-- Kenapa tolerance 0.01?
--   → Konsisten dengan Zod validation dan useBalanceSheet.ts balance check
--   → Mengakomodasi floating point arithmetic di NUMERIC type

DROP TRIGGER IF EXISTS trg_check_journal_balance ON journal_lines;

CREATE CONSTRAINT TRIGGER trg_check_journal_balance
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_journal_lines_balance();

-- ============================================================
-- ROLLBACK:
-- DROP TRIGGER IF EXISTS trg_check_journal_balance ON journal_lines;
-- DROP FUNCTION IF EXISTS check_journal_lines_balance();
-- ============================================================
