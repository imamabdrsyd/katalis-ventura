-- Migration 121: uniqueness katalog pindah dari NAMA ke SKU
--
-- Keputusan produk: nama item TIDAK wajib unik — varian sah punya nama sama
-- (mis. "Castor Oil" ukuran L & S, atau harga normal vs reseller). Yang harus
-- unik adalah SKU, karena itulah identitas item untuk matching import
-- marketplace & stok.
--
-- SKU tetap OPSIONAL: index parsial hanya menjaring baris yang benar-benar
-- punya SKU, jadi banyak item tanpa SKU tidak saling bentrok.
-- Diverifikasi sebelum apply: 0 SKU duplikat di data existing.

-- 1. Nama tidak lagi unik
DROP INDEX IF EXISTS idx_catalog_items_unique_name;

-- 2. SKU unik per bisnis (case-insensitive, abaikan NULL & string kosong,
--    hanya item yang belum dihapus)
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_items_unique_sku
  ON catalog_items(business_id, LOWER(btrim(sku)))
  WHERE deleted_at IS NULL AND sku IS NOT NULL AND btrim(sku) <> '';

COMMENT ON INDEX idx_catalog_items_unique_sku IS
  'SKU unik per bisnis (case-insensitive, trim). Nama item sengaja TIDAK unik — lihat migr 121.';
