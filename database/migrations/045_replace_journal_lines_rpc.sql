-- ============================================================
-- 045_replace_journal_lines_rpc.sql
-- RPC function untuk atomic replace journal_lines saat update
-- multi-line journal entry.
--
-- PROBLEM:
-- Sebelumnya, update dilakukan via 2 HTTP request terpisah:
--   1. DELETE FROM journal_lines WHERE transaction_id = id
--   2. INSERT INTO journal_lines (...) VALUES (...)
--
-- Setiap request adalah transaction DB tersendiri. Di antara
-- request ke-1 dan ke-2, constraint trigger
-- trg_check_journal_balance (DEFERRABLE INITIALLY DEFERRED)
-- fire saat commit request ke-1 dan throw error karena transaksi
-- multi-line tidak punya baris (min 2). DELETE di-rollback,
-- lalu INSERT sukses → duplikat baris.
--
-- SOLUSI:
-- Wrap DELETE + INSERT dalam satu function PostgreSQL. Semua
-- statement di dalam function berjalan dalam satu transaction,
-- sehingga deferred trigger hanya fire sekali di akhir.
-- ============================================================

CREATE OR REPLACE FUNCTION replace_journal_lines(
  p_transaction_id UUID,
  p_lines JSONB
)
RETURNS VOID AS $$
DECLARE
  v_line JSONB;
  v_sort_order INTEGER := 0;
BEGIN
  -- Authorization: pastikan user adalah business_manager
  IF NOT EXISTS (
    SELECT 1
      FROM transactions t
      JOIN user_business_roles ubr ON ubr.business_id = t.business_id
     WHERE t.id = p_transaction_id
       AND ubr.user_id = auth.uid()
       AND ubr.role IN ('business_manager', 'both')
  ) THEN
    RAISE EXCEPTION 'Tidak berhak mengubah jurnal transaksi ini';
  END IF;

  -- Hapus baris lama
  DELETE FROM journal_lines WHERE transaction_id = p_transaction_id;

  -- Insert baris baru
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO journal_lines (
      transaction_id,
      account_id,
      debit_amount,
      credit_amount,
      description,
      sort_order
    ) VALUES (
      p_transaction_id,
      (v_line->>'account_id')::UUID,
      COALESCE((v_line->>'debit_amount')::NUMERIC, 0),
      COALESCE((v_line->>'credit_amount')::NUMERIC, 0),
      NULLIF(v_line->>'description', ''),
      COALESCE((v_line->>'sort_order')::INTEGER, v_sort_order)
    );
    v_sort_order := v_sort_order + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Grant execute to authenticated users (authorization dilakukan di dalam function)
GRANT EXECUTE ON FUNCTION replace_journal_lines(UUID, JSONB) TO authenticated;

-- ============================================================
-- ROLLBACK:
-- DROP FUNCTION IF EXISTS replace_journal_lines(UUID, JSONB);
-- ============================================================
