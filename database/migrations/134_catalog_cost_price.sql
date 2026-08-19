-- Migration 134: Jembatan stok ↔ ledger — `catalog_items.cost_price`
--
-- MASALAH YANG DITUTUP (temuan audit inventory 18 Juli 2026):
-- Checkout kasir POS (`useCashier.checkout`) hanya mencatat sisi penjualan —
-- Dr Kas / Cr Pendapatan — lalu mengurangi `stock_qty` lewat RPC
-- `decrement_catalog_stock`. Pengurangan stok itu murni angka kuantitas: TIDAK
-- ada jurnal yang melepas nilainya dari akun Persediaan. Akibatnya, untuk bisnis
-- yang mengkapitalisasi pembelian stok ke akun ASSET:
--   1. Persediaan di Neraca tetap penuh padahal barangnya sudah keluar (aset
--      overstated), dan
--   2. HPP tidak pernah diakui di periode penjualan → Laba Kotor overstated.
--
-- Satu-satunya jembatan yang ada sebelumnya adalah `handleConvertStockToCOGS`
-- (InventoryPicker), yang MENGUBAH `debit_account_id` transaksi PEMBELIAN lama
-- dari Persediaan ke HPP. Itu memindahkan beban ke periode pembelian, bukan
-- periode penjualan — melanggar matching principle dan memutasi jurnal historis.
--
-- YANG DITAMBAHKAN DI SINI: satu kolom, `cost_price` — harga pokok per satuan
-- item katalog. Dengan ini checkout POS bisa merakit jurnal HPP tersendiri
-- (Dr HPP / Cr Persediaan) bertanggal hari penjualan, tanpa menyentuh jurnal
-- pembelian mana pun.
--
-- SENGAJA TIDAK DI-BACKFILL. Default 0 = fitur mati sampai pemilik mengisi
-- harga pokok per item. Menebak cost dari transaksi pembelian lama berisiko
-- membebankan HPP yang salah ke buku yang sudah berjalan; opt-in per item jauh
-- lebih aman. Konsekuensinya: buku yang sudah ada TIDAK berubah sama sekali
-- oleh migrasi ini.
--
-- CATATAN COSTING: ini standard cost (harga pokok tetap per item, diisi manual),
-- bukan moving average / FIFO. Konsisten dengan `default_price` yang juga input
-- manual. Costing berbasis riwayat pembelian = fase berikutnya bila dibutuhkan.

BEGIN;

ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(15,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalog_items_cost_price_check'
  ) THEN
    ALTER TABLE catalog_items
      ADD CONSTRAINT catalog_items_cost_price_check
      CHECK (cost_price >= 0);
  END IF;
END $$;

COMMENT ON COLUMN catalog_items.cost_price IS
  'Harga pokok per satuan (standard cost, input manual). Dipakai checkout POS untuk merakit jurnal HPP: Dr HPP / Cr Persediaan sebesar cost_price x qty. 0 = tidak dicatat otomatis. Hanya berlaku bila track_stock=true DAN bisnis punya akun Persediaan (ASSET) di CoA — tanpa akun itu, pembelian stok sudah dibebankan saat beli, jadi mencatat HPP lagi = dobel.';

COMMIT;
