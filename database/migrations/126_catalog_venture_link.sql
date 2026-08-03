-- Migration 126: Asset Console — kelas aset "venture" (kepemilikan di bisnis sendiri)
--
-- KONTEKS: Asset Console selama ini mengagregasi transaksi yang tertaut ke item
-- katalog (migrasi 125). Kelas "venture" berbeda sifatnya: yang dipantau BUKAN
-- transaksi di bisnis pemantau, melainkan posisi ekuitas pemilik DI BISNIS LAIN
-- yang sama-sama ada di AXION (mis. saham Imam di "Hillside Studio").
--
-- Angka-angkanya diturunkan dari buku besar bisnis TARGET, bukan dari transaksi
-- baru apa pun:
--   Total Modal  = net credit akun EQUITY is_stock milik user  (calculateCapTable)
--   Kepemilikan  = kontribusi akun itu / total semua akun stock (calculateCapTable)
--   Nilai Pasar  = kepemilikan% × Total Ekuitas bisnis target  (calculateBalanceSheet)
-- Tetap nol ledger paralel: tidak ada satu pun angka yang disimpan di sini.
--
-- Yang ditambahkan: dua kolom penunjuk. `catalog_items` dipakai ulang sebagai
-- master instrumen (bukan tabel baru) supaya semua kelas aset punya satu
-- registry — tapi baris venture disembunyikan dari halaman Katalog, karena ia
-- bukan barang/jasa yang bisa dijual dan tidak punya SKU/stok/harga jual.

BEGIN;

-- ── 1. Kolom penunjuk ───────────────────────────────────────────────────────
-- ON DELETE CASCADE (bukan SET NULL): baris venture TIDAK bermakna tanpa
-- target-nya, dan CHECK di bawah mewajibkan kedua kolom terisi — SET NULL akan
-- membuat baris melanggar constraint-nya sendiri. Praktiknya bisnis diarsipkan
-- (is_archived), bukan dihapus, jadi cascade ini jalur pengaman saja.
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS linked_business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS linked_stock_account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- ── 2. Longgarkan CHECK asset_class ─────────────────────────────────────────
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_asset_class_check;
ALTER TABLE catalog_items
  ADD CONSTRAINT catalog_items_asset_class_check
  CHECK (asset_class IS NULL OR asset_class IN ('stock', 'crypto', 'property', 'gold', 'venture'));

-- ── 3. Tautan hanya sah untuk venture, dan venture wajib punya tautan ────────
-- Dua arah sekaligus supaya tidak ada baris "venture tanpa target" (yang akan
-- tampil sebagai Rp0 misterius di Asset Console) maupun kolom tautan nyasar di
-- item katalog biasa.
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_venture_link_check;
ALTER TABLE catalog_items
  ADD CONSTRAINT catalog_items_venture_link_check
  CHECK (
    CASE WHEN asset_class = 'venture'
      THEN linked_business_id IS NOT NULL AND linked_stock_account_id IS NOT NULL
      ELSE linked_business_id IS NULL AND linked_stock_account_id IS NULL
    END
  );

-- ── 4. Satu akun ekuitas cuma boleh ditautkan sekali ────────────────────────
-- Tanpa ini, menautkan "Imam @ Hillside" dua kali akan menggandakan Total Modal
-- dan Nilai Pasar di KPI — double counting yang sulit dilacak user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_items_venture_link
  ON catalog_items(business_id, linked_stock_account_id)
  WHERE asset_class = 'venture' AND deleted_at IS NULL;

COMMENT ON COLUMN catalog_items.linked_business_id IS
  'Hanya untuk asset_class=venture: bisnis lain di AXION yang kepemilikannya dipantau.';
COMMENT ON COLUMN catalog_items.linked_stock_account_id IS
  'Hanya untuk asset_class=venture: akun EQUITY is_stock milik user di bisnis target. Cost basis & % kepemilikan dibaca dari cap table bisnis itu.';

COMMIT;
