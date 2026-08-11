-- Migration 130: Perbaiki cast JSONB yang membuat penghapusan pelunasan SEBAGIAN
-- selalu gagal di `soft_delete_transaction`. Ditemukan saat menguji migrasi 129.
--
-- MASALAH (bug live, bukan sekadar kerapian)
-- Cabang partial settlement di migrasi 108/109 menyaring array `partial_settlements`
-- dengan:
--
--     SELECT jsonb_agg(val)
--     FROM jsonb_array_elements(t.meta->'partial_settlements') val
--     WHERE val::text::uuid != transaction_id
--
-- `jsonb_array_elements` (tanpa `_text`) menghasilkan elemen bertipe JSONB, sehingga
-- `val::text` masih membawa tanda kutip: "5e52b973-...". Cast ke UUID lalu meledak:
--
--     ERROR 22P02: invalid input syntax for type uuid: ""5e52b973-...""
--
-- Klausa WHERE di baris berikutnya sudah memakai `jsonb_array_elements_text` yang benar,
-- jadi barisnya TERPILIH lalu ekspresi SET-nya gagal — artinya RPC melempar exception dan
-- seluruh penghapusan dibatalkan. Efek yang dirasakan user: entri pelunasan sebagian
-- TIDAK BISA dihapus sama sekali (HTTP 500), bukan sekadar meta yang tidak ter-update.
-- Saat migrasi ini ditulis ada 8 tagihan dengan 14 cicilan hidup yang terkena.
--
-- Cabang full settlement tidak terpengaruh (tidak menyentuh array), itu sebabnya bug ini
-- lolos: jalur yang paling sering dipakai justru yang sehat.
--
-- PERBAIKAN
-- Pakai `jsonb_array_elements_text` (elemen sudah berupa TEXT telanjang), bandingkan
-- sebagai text, lalu bungkus lagi jadi JSONB string dengan `to_jsonb`.
--
-- Sisa fungsi identik dengan migrasi 109 (termasuk penghapusan `remaining_amount` pada
-- full settlement) agar tidak ada drift baru.

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

  -- 2. Kalau yang dihapus adalah entri PELUNASAN, bersihkan jejaknya di tagihan asal
  SELECT
    (meta->>'settlement_of_transaction_id')::uuid,
    amount
  INTO v_original_id, v_deleted_amount
  FROM transactions
  WHERE id = transaction_id
    AND meta ? 'settlement_of_transaction_id';

  IF v_original_id IS NOT NULL THEN
    -- A. Full settlement: cabut jejak lunas DAN remaining_amount
    --    (agar sisa tagihan dihitung ulang dari nilai brutonya).
    UPDATE transactions t
    SET meta = t.meta - 'settled_by_transaction_id' - 'remaining_amount'
    WHERE t.id = v_original_id
      AND t.meta ? 'settled_by_transaction_id'
      AND (t.meta->>'settled_by_transaction_id')::uuid = transaction_id;

    -- B. Partial settlement: keluarkan id dari array & kembalikan nominalnya ke sisa.
    UPDATE transactions t
    SET meta = jsonb_set(
      jsonb_set(
        t.meta,
        '{partial_settlements}',
        COALESCE(
          (
            -- `_text` -> elemen sudah TEXT telanjang, bandingkan sebagai text lalu
            -- bungkus ulang jadi JSONB string. Inilah inti perbaikan migrasi 130.
            SELECT jsonb_agg(to_jsonb(val))
            FROM jsonb_array_elements_text(t.meta->'partial_settlements') val
            WHERE val <> transaction_id::text
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
        SELECT value FROM jsonb_array_elements_text(t.meta->'partial_settlements')
      );
  END IF;

END;
$$;

GRANT EXECUTE ON FUNCTION soft_delete_transaction(UUID) TO authenticated;

COMMENT ON FUNCTION soft_delete_transaction IS
  'Soft-delete transaksi. Bila yang dihapus adalah entri pelunasan, jejak lunas di '
  'tagihan asal ikut dicabut (migr 108/109; cast array diperbaiki migr 130).';

SELECT 'Migration 130 complete - fix partial settlement jsonb cast in soft delete' as status;
