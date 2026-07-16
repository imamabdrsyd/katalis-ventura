-- Migration 119: Backfill catalog untuk transaksi stok (VAR → akun persediaan)
--
-- Fitur "chip katalog di kolom deskripsi" (TransactionList) membaca
-- meta.catalog_item {id, name}. Transaksi stok lama belum punya link ini.
-- Migrasi ini:
--   1. Membuat catalog_items dari nama bersih deskripsi transaksi stok.
--      Nama bersih = deskripsi dipotong pada kurung buka pertama, karena
--      catatan pembayaran ditulis dalam kurung:
--      "Yamaha NMAX (dibayar dari return sebelumnya: ...)" → "Yamaha NMAX"
--   2. Menautkan tiap transaksi stok ke item katalog via meta.catalog_item.
--
-- Definisi "transaksi stok" mengikuti isInventoryAccount() di
-- src/lib/utils/inventoryHelper.ts: kategori VAR dengan debit akun ASSET yang
-- default_category-nya VAR atau bernama persediaan/inventory/stok/barang/bahan.

BEGIN;

-- 1. Buat item katalog per nama bersih unik per bisnis (yang sudah ada di-skip
--    lewat unique index idx_catalog_items_unique_name)
INSERT INTO catalog_items (business_id, name, item_type, default_price, created_by)
SELECT DISTINCT ON (t.business_id, lower(btrim(regexp_replace(t.description, '\s*\(.*$', ''))))
  t.business_id,
  btrim(regexp_replace(t.description, '\s*\(.*$', '')),
  'product',
  0,
  t.created_by
FROM transactions t
JOIN accounts a ON a.id = t.debit_account_id
WHERE t.category = 'VAR'
  AND t.deleted_at IS NULL
  AND a.account_type = 'ASSET'
  AND (a.default_category = 'VAR' OR a.account_name ~* 'persediaan|inventory|stok|barang|bahan')
  AND NOT COALESCE(t.meta, '{}'::jsonb) ? 'catalog_item'
  AND btrim(regexp_replace(COALESCE(t.description, ''), '\s*\(.*$', '')) <> ''
ON CONFLICT (business_id, lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- 2. Link transaksi stok → item katalog.
--    Trigger user dimatikan sementara: backfill tidak boleh menimpa
--    updated_at/updated_by (auth.uid() NULL di konteks migrasi) dan tidak
--    perlu membanjiri audit_log dengan ~50 entry meta-only.
ALTER TABLE transactions DISABLE TRIGGER USER;

UPDATE transactions t
SET meta = COALESCE(t.meta, '{}'::jsonb)
        || jsonb_build_object('catalog_item', jsonb_build_object('id', ci.id, 'name', ci.name))
FROM accounts a, catalog_items ci
WHERE a.id = t.debit_account_id
  AND ci.business_id = t.business_id
  AND ci.deleted_at IS NULL
  AND lower(ci.name) = lower(btrim(regexp_replace(t.description, '\s*\(.*$', '')))
  AND t.category = 'VAR'
  AND t.deleted_at IS NULL
  AND a.account_type = 'ASSET'
  AND (a.default_category = 'VAR' OR a.account_name ~* 'persediaan|inventory|stok|barang|bahan')
  AND NOT COALESCE(t.meta, '{}'::jsonb) ? 'catalog_item';

ALTER TABLE transactions ENABLE TRIGGER USER;

COMMIT;
