-- Migration 109: Restore Remaining Amount on Soft Deleted Full Settlements
--
-- Konteks:
--   Pada saat transaksi pelunasan penuh (full settlement) dibuat, RPC
--   `settle_transaction` secara otomatis mengeset `meta.remaining_amount = 0`.
--   Namun, saat pelunasan penuh tersebut dihapus, Migration 108 dan fungsi 
--   `soft_delete_transaction` hanya menghapus `meta.settled_by_transaction_id` 
--   tapi membiarkan angka `remaining_amount` tetap 0. Hal ini menyebabkan 
--   tagihan asal tampak sudah lunas (Remaining 0) walau ID pelunasan telah dicabut.
--
-- Perbaikan:
--   1. Data Cleanup: Menghapus field `remaining_amount` pada transaksi yang memiliki 
--      `remaining_amount = 0` namun tidak memiliki `settled_by_transaction_id`. 
--      (Sistem TypeScript dan RPC di server akan secara otomatis menghitung ulang 
--       nilainya dari sisa `partial_settlements` yang ada).
--   2. Update Fungsi `soft_delete_transaction`: Memastikan bahwa penghapusan 
--      full settlement ikut menghapus `remaining_amount` dari transaksi asal.
--

-- ==============================================================================
-- 1. BACKFILL DATA (Cleanup 0 Remaining Amount)
-- ==============================================================================

UPDATE transactions
SET meta = meta - 'remaining_amount'
WHERE meta ? 'remaining_amount'
  AND (meta->>'remaining_amount')::NUMERIC = 0
  AND NOT (meta ? 'settled_by_transaction_id')
  AND deleted_at IS NULL;

-- ==============================================================================
-- 2. UPDATE RPC `soft_delete_transaction`
-- ==============================================================================

CREATE OR REPLACE FUNCTION soft_delete_transaction(transaction_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_id UUID;
  v_deleted_amount NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM transactions t
    WHERE t.id = transaction_id
      AND t.deleted_at IS NULL
      AND is_business_manager(t.business_id)
  ) THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan atau tidak berhak menghapus'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Soft delete transaksi
  UPDATE transactions
  SET deleted_at = NOW(),
      deleted_by = auth.uid()
  WHERE id = transaction_id;

  -- 2. Jika transaksi yang baru dihapus ini adalah PELUNASAN, bersihkan meta tagihan aslinya
  
  -- Ambil ID tagihan asli dan jumlah pelunasannya
  SELECT 
    (meta->>'settlement_of_transaction_id')::uuid,
    amount
  INTO v_original_id, v_deleted_amount
  FROM transactions
  WHERE id = transaction_id
    AND meta ? 'settlement_of_transaction_id';

  IF v_original_id IS NOT NULL THEN
    -- A. Apakah ini Full Settlement?
    -- Hapus jejak lunas DAN hapus remaining_amount (agar di-kalkulasi ulang sistem)
    UPDATE transactions t
    SET meta = t.meta - 'settled_by_transaction_id' - 'remaining_amount'
    WHERE t.id = v_original_id
      AND t.meta ? 'settled_by_transaction_id'
      AND (t.meta->>'settled_by_transaction_id')::uuid = transaction_id;

    -- B. Apakah ini Partial Settlement?
    UPDATE transactions t
    SET meta = jsonb_set(
      jsonb_set(
        t.meta,
        '{partial_settlements}',
        COALESCE(
          (
            SELECT jsonb_agg(val)
            FROM jsonb_array_elements(t.meta->'partial_settlements') val
            WHERE val::text::uuid != transaction_id
          ),
          '[]'::jsonb
        )
      ),
      '{remaining_amount}',
      to_jsonb(
        COALESCE((t.meta->>'remaining_amount')::NUMERIC, 0) + v_deleted_amount
      )
    )
    WHERE t.id = v_original_id
      AND t.meta ? 'partial_settlements'
      AND transaction_id::text IN (
        SELECT value::text FROM jsonb_array_elements_text(t.meta->'partial_settlements')
      );
  END IF;

END;
$$;

GRANT EXECUTE ON FUNCTION soft_delete_transaction(UUID) TO authenticated;

SELECT 'Migration 109 complete - restore remaining amount on soft delete' as status;
