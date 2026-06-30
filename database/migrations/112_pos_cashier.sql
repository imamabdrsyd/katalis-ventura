-- Migration 112: POS Cashier
-- Mendukung fitur kasir (Point of Sales) di hub /point-of-sales:
--   1. Stok sederhana opt-in di catalog_items (track_stock + stock_qty).
--      Hanya item dengan track_stock=true yang dikurangi saat checkout.
--      Item lama & jasa tidak terpengaruh (default track_stock=false).
--   2. Foto QRIS statis per bisnis (businesses.qris_image_url) untuk discan
--      pelanggan sebelum integrasi payment gateway.
--   3. RPC decrement_catalog_stock() untuk pengurangan stok atomik & aman
--      (guard track_stock + kepemilikan bisnis via get_my_business_ids).

-- 1. Stok sederhana di catalog_items
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS track_stock BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stock_qty NUMERIC NOT NULL DEFAULT 0 CHECK (stock_qty >= 0);

COMMENT ON COLUMN catalog_items.track_stock IS 'Opt-in: true = stok dilacak & dikurangi saat checkout POS';
COMMENT ON COLUMN catalog_items.stock_qty IS 'Sisa stok saat ini (hanya relevan bila track_stock=true)';

-- 2. Foto QRIS statis per bisnis
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS qris_image_url TEXT;

COMMENT ON COLUMN businesses.qris_image_url IS 'URL gambar QRIS statis (Cloudinary) untuk pembayaran POS';

-- 3. RPC pengurangan stok atomik
-- SECURITY DEFINER agar bisa update meski dipanggil dari klien; guard memastikan
-- item milik bisnis user (get_my_business_ids) dan track_stock aktif.
-- Mengurangi stok tanpa pernah menembus 0 (GREATEST). Return sisa stok baru.
CREATE OR REPLACE FUNCTION decrement_catalog_stock(
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
    RAISE EXCEPTION 'Jumlah pengurangan stok harus > 0';
  END IF;

  UPDATE catalog_items
  SET stock_qty = GREATEST(0, stock_qty - p_qty)
  WHERE id = p_item_id
    AND track_stock = TRUE
    AND deleted_at IS NULL
    AND business_id IN (SELECT get_my_business_ids())
  RETURNING stock_qty INTO v_new_qty;

  -- Bila item tidak ditemukan / tidak track_stock / bukan milik user,
  -- v_new_qty NULL → tidak melempar error (checkout tetap lanjut, stok diabaikan).
  RETURN v_new_qty;
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_catalog_stock(UUID, NUMERIC) TO authenticated;
