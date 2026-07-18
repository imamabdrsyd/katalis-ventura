-- Migration 120: RPC penambahan stok katalog (increment_catalog_stock)
-- Pasangan decrement_catalog_stock (Migration 112) untuk aksi "Tambah Stok"
-- dari halaman Katalog. Berbeda dengan decrement (dipanggil checkout POS oleh
-- member bisnis mana pun), penambahan stok adalah aksi manajemen — hanya
-- business manager yang boleh.

CREATE OR REPLACE FUNCTION increment_catalog_stock(
  p_item_id UUID,
  p_qty NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_qty NUMERIC;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Jumlah penambahan stok harus > 0';
  END IF;

  UPDATE catalog_items
  SET stock_qty = stock_qty + p_qty
  WHERE id = p_item_id
    AND track_stock = TRUE
    AND deleted_at IS NULL
    AND is_business_manager(business_id)
  RETURNING stock_qty INTO v_new_qty;

  -- NULL bila item tidak ditemukan / tidak track_stock / user bukan manager —
  -- caller menampilkan error yang ramah.
  RETURN v_new_qty;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_catalog_stock(UUID, NUMERIC) TO authenticated;
