-- Migration 123: tandai SUMBER perubahan stok di audit_log (metadata.source)
--
-- Kebutuhan: panel Riwayat Stok ingin memberi chip "Penjualan" pada pengurangan
-- yang berasal dari checkout kasir, tapi audit trigger tidak tahu jalur kode
-- mana yang melakukan UPDATE.
--
-- Mekanisme: RPC stok men-set GUC transaksi-lokal `app.audit_source` sebelum
-- UPDATE (set_config(..., is_local=true) — otomatis bersih di akhir transaksi),
-- lalu `log_audit_trail()` menyalinnya ke metadata.source. Jalur lain (form
-- edit manual) tidak men-set apa-apa → source NULL → tanpa chip.
--
--   pos_sale  = pengurangan dari checkout kasir (decrement_catalog_stock)
--   stock_add = penambahan dari aksi "Tambah Stok" (increment_catalog_stock)

-- 1. Trigger: sertakan metadata.source bila GUC di-set
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
  business_id_value UUID;
  new_data JSONB;
  old_data JSONB;
  meta JSONB;
BEGIN
  new_data := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  old_data := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;

  IF TG_TABLE_NAME = 'businesses' THEN
    business_id_value := COALESCE(new_data->>'id', old_data->>'id')::UUID;
  ELSE
    business_id_value := COALESCE(new_data->>'business_id', old_data->>'business_id')::UUID;
  END IF;

  meta := jsonb_build_object(
    'business_id', business_id_value,
    'source', NULLIF(current_setting('app.audit_source', true), '')
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values, changed_by, metadata)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', NULL, new_data, auth.uid(), meta);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD IS DISTINCT FROM NEW THEN
      INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values, changed_by, metadata)
      VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', old_data, new_data, auth.uid(), meta);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values, changed_by, metadata)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', old_data, NULL, auth.uid(), meta);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC decrement (checkout kasir) → source 'pos_sale'
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

  PERFORM set_config('app.audit_source', 'pos_sale', true);

  UPDATE catalog_items
  SET stock_qty = GREATEST(0, stock_qty - p_qty)
  WHERE id = p_item_id
    AND track_stock = TRUE
    AND deleted_at IS NULL
    AND business_id IN (SELECT get_my_business_ids())
  RETURNING stock_qty INTO v_new_qty;

  RETURN v_new_qty;
END;
$$;

-- 3. RPC increment (aksi Tambah Stok) → source 'stock_add'
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

  PERFORM set_config('app.audit_source', 'stock_add', true);

  UPDATE catalog_items
  SET stock_qty = stock_qty + p_qty
  WHERE id = p_item_id
    AND track_stock = TRUE
    AND deleted_at IS NULL
    AND is_business_manager(business_id)
  RETURNING stock_qty INTO v_new_qty;

  RETURN v_new_qty;
END;
$$;

-- 4. Backfill: baris pengurangan stok yang sudah ada.
-- Diverifikasi sebelum apply: HANYA 2 baris pengurangan stok di audit_log
-- (Castor Oil (L) 100→98→96) dan keduanya berasal dari checkout POS —
-- aman ditandai pos_sale. Pengurangan via form edit belum pernah terjadi.
UPDATE audit_log
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{source}', '"pos_sale"')
WHERE table_name = 'catalog_items'
  AND operation = 'UPDATE'
  AND (metadata->>'source') IS NULL
  AND (old_values->>'stock_qty') IS NOT NULL
  AND (new_values->>'stock_qty') IS NOT NULL
  AND (old_values->>'stock_qty')::numeric > (new_values->>'stock_qty')::numeric;
