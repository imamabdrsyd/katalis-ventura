-- Migration 135: Akun Persediaan untuk bisnis yang melacak stok tapi belum punya
--
-- KONTEKS: migrasi 134 memasang jembatan stok → ledger (auto-HPP saat checkout
-- POS). Jembatan itu punya gerbang wajib "bisnis punya akun Persediaan", karena
-- tanpa akun itu pembelian stok sudah dibebankan langsung saat beli — menjurnal
-- HPP lagi saat jual berarti dobel hitung. Konsekuensinya, bisnis yang benar-
-- benar melacak stok tapi CoA-nya tak punya akun Persediaan tidak akan pernah
-- kebagian fitur ini, padahal merekalah yang paling butuh.
--
-- Migrasi ini menutup celah itu: buat satu akun `1500 Persediaan` untuk setiap
-- bisnis aktif yang punya item katalog ber-`track_stock` TAPI belum punya akun
-- ASSET yang terbaca sebagai persediaan (kriteria sama persis dengan resolver
-- `resolveInventoryAccount` di `src/lib/accounting/salesCheckout.ts`:
-- default_category='VAR' dulu, nama akun sebagai cadangan).
--
-- Per 20 Agustus 2026 kriteria ini kena TEPAT SATU bisnis: elvéa Indonesia.
-- Bisnis produk lain (More&Tea) tak punya item ber-track_stock, jadi sengaja
-- TIDAK ikut — akun kosong yang tak pernah dipakai hanya mengotori CoA.
--
-- ⚠️ MEMBUAT AKUN SAJA TIDAK MENGUBAH SATU PUN ANGKA. Akun ini lahir dengan
-- saldo nol dan migrasi ini TIDAK menyentuh transaksi mana pun. Supaya HPP
-- otomatis benar, pemilik masih harus:
--   1. mencatat pembelian stok berikutnya dengan DEBIT ke 1500 (bukan ke HPP), dan
--   2. mengisi `catalog_items.cost_price` per item.
-- Mengisi cost_price TANPA (1) justru membuat beban terhitung dua kali dan
-- saldo persediaan minus. Urutan ini sengaja tidak diotomatiskan: menebak harga
-- pokok lalu memposting angka tebakan ke buku besar nyata bukan wewenang migrasi.
--
-- Catatan khusus elvéa: mereka PRODUSEN, bukan pengecer. 46 transaksi VAR-nya
-- adalah bahan baku & kemasan (castor oil 10L, shampo 60L, botol, label, shrink)
-- dan NOL di antaranya tertaut ke item katalog. Harga pokok per produk jadi
-- butuh bill of materials (isi cair per ml + botol + label + shrink) yang belum
-- ada di aplikasi. Jadi untuk mereka akun ini menyiapkan tempatnya; pengisian
-- nilainya menyusul saat BOM tersedia atau lewat stock opname manual.

BEGIN;

INSERT INTO accounts (
  business_id, account_code, account_name, account_type, parent_account_id,
  normal_balance, is_active, is_system, sort_order, default_category, description
)
SELECT
  b.id,
  '1500',
  'Persediaan',
  'ASSET',
  parent.id,
  'DEBIT',
  true,
  false,   -- bukan akun sistem: pemilik boleh mengganti nama / menonaktifkan
  1500,
  'VAR',   -- penanda STRUKTURAL yang dibaca resolveInventoryAccount, bukan namanya
  'Nilai stok barang yang belum terjual. Debit saat beli/produksi, kredit saat terjual (HPP).'
FROM businesses b
JOIN accounts parent
  ON parent.business_id = b.id
 AND parent.account_type = 'ASSET'
 AND parent.parent_account_id IS NULL
WHERE b.is_archived = false
  AND EXISTS (
    SELECT 1 FROM catalog_items ci
    WHERE ci.business_id = b.id AND ci.deleted_at IS NULL AND ci.track_stock
  )
  AND NOT EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.business_id = b.id
      AND a.is_active
      AND a.account_type = 'ASSET'
      AND (a.default_category = 'VAR'
           OR a.account_name ~* 'persediaan|inventory|stok|barang|bahan')
  )
  -- Idempoten: jangan bentrok bila kode 1500 sudah dipakai untuk hal lain.
  AND NOT EXISTS (
    SELECT 1 FROM accounts a2
    WHERE a2.business_id = b.id AND a2.account_code = '1500'
  );

COMMIT;
