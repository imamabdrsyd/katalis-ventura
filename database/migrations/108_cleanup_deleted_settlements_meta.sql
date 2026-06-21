-- Migration 108: Cleanup Orphaned Settlement Meta and Update Soft Delete
--
-- Konteks:
--   Sebelumnya, ketika transaksi pelunasan dihapus (soft delete), jejak ID pelunasan
--   tersebut tidak dihapus dari `meta.settled_by_transaction_id` atau 
--   `meta.partial_settlements` pada transaksi asalnya. Akibatnya, UI klien mengira
--   transaksi tersebut masih lunas (PAID).
--
-- Perbaikan:
--   1. Data Cleanup (Backfill): Mencari semua transaksi yang memiliki orphaned 
--      settlement IDs dan membersihkannya dari `meta`.
--   2. Update Fungsi `soft_delete_transaction`: Menambahkan logika trigger otomatis 
--      untuk membersihkan meta pada transaksi asal setiap kali pelunasannya dihapus.
--

-- ==============================================================================
-- 1. BACKFILL DATA (Cleanup Orphaned Meta)
-- ==============================================================================

-- A. Cleanup Orphaned `settled_by_transaction_id` (Full Settlement)
UPDATE transactions t
SET meta = t.meta - 'settled_by_transaction_id'
FROM transactions s
WHERE t.meta ? 'settled_by_transaction_id'
  AND (t.meta->>'settled_by_transaction_id')::uuid = s.id
  AND s.deleted_at IS NOT NULL
  AND t.deleted_at IS NULL;

-- B. Cleanup Orphaned `partial_settlements` (Partial Settlement)
-- Harus menghapus ID pelunasan yang sudah dihapus dari array JSONB `partial_settlements`
-- dan menambah kembali `remaining_amount` sesuai jumlah pelunasan yang dihapus.
WITH orphaned_partials AS (
  SELECT 
    t.id AS original_id,
    p.id AS orphaned_id,
    p.amount AS orphaned_amount
  FROM transactions t,
       jsonb_array_elements_text(t.meta->'partial_settlements') AS pid
  JOIN transactions p ON p.id::text = pid
  WHERE t.meta ? 'partial_settlements'
    AND p.deleted_at IS NOT NULL
    AND t.deleted_at IS NULL
)
UPDATE transactions t
SET meta = (
  SELECT jsonb_set(
    jsonb_set(
      t.meta,
      '{partial_settlements}',
      COALESCE(
        (
          SELECT jsonb_agg(val)
          FROM jsonb_array_elements(t.meta->'partial_settlements') val
          WHERE val::text::uuid NOT IN (
            SELECT orphaned_id FROM orphaned_partials WHERE original_id = t.id
          )
        ),
        '[]'::jsonb
      )
    ),
    '{remaining_amount}',
    to_jsonb(
      COALESCE((t.meta->>'remaining_amount')::NUMERIC, 0) + 
      (SELECT SUM(orphaned_amount) FROM orphaned_partials WHERE original_id = t.id)
    )
  )
)
WHERE t.id IN (SELECT original_id FROM orphaned_partials);

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
  
  -- Ambil ID tagihan asli dan jumlah pelunasannya (jika ini adalah transaksi pelunasan)
  SELECT 
    (meta->>'settlement_of_transaction_id')::uuid,
    amount
  INTO v_original_id, v_deleted_amount
  FROM transactions
  WHERE id = transaction_id
    AND meta ? 'settlement_of_transaction_id';

  IF v_original_id IS NOT NULL THEN
    -- A. Apakah ini Full Settlement?
    UPDATE transactions t
    SET meta = t.meta - 'settled_by_transaction_id'
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

SELECT 'Migration 108 complete - cleanup orphaned settlement meta and update soft delete' as status;
