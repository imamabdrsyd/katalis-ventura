-- Migration 125: Asset Console — asset_class di catalog_items + link katalog pada transaksi jual
--
-- KEPUTUSAN ARSITEKTUR: Asset Console TIDAK membangun ledger paralel (tabel
-- asset_positions/asset_position_events yang sempat diusulkan). `transactions`
-- tetap satu-satunya source of truth; Asset Console murni read-model yang
-- mengagregasi transaksi yang sudah tertaut ke item katalog lewat
-- meta.catalog_item (pola yang dipasang migrasi 119). Konsekuensinya tidak ada
-- kemungkinan drift antara "posisi" dan buku besar — posisi ADALAH buku besar.
--
-- Yang ditambahkan di sini:
--   1. catalog_items.asset_class     — opt-in: item katalog mana yang muncul di
--                                      Asset Console. NULL = produk/jasa biasa
--                                      (motor, F&B, dst) → tidak ikut.
--   2. catalog_items.asset_lot_size  — jembatan satuan. Transaksi mencatat
--                                      kuantitas dalam LOT (meta.unit_breakdown
--                                      .unit = 'Lot BMRI'), sedangkan
--                                      catalog_items.unit = 'Lembar' dan
--                                      default_price dikutip per lembar.
--                                      Saham IDX = 100. Default 1 (crypto/gram
--                                      emas/properti: kuantitas = satuan harga).
--   3. catalog_items.asset_price_updated_at — kapan default_price (dipakai
--                                      sebagai harga pasar terakhir) di-update
--                                      manual. Fase 1 tanpa live feed.
--   4. Backfill meta.catalog_item pada transaksi JUAL.
--
-- Kenapa (4) perlu: sampai sekarang hanya transaksi BELI yang membawa
-- meta.catalog_item. Transaksi jual (EARN multi-line: Dr Bank / Cr Persediaan /
-- Cr Pendapatan) tidak tertaut ke instrumen apa pun, sehingga agregasi akan
-- menghitung posisi BRUTO — BBCA terbaca 7 lot / Rp4.011.251 padahal realitanya
-- tersisa 1 lot / Rp578.310 setelah dua kali jual @3 lot. Backfill ini
-- meta-only: nominal, akun, dan journal_lines TIDAK disentuh sama sekali.

BEGIN;

-- ── 1. Kolom baru di catalog_items ──────────────────────────────────────────
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS asset_class TEXT,
  ADD COLUMN IF NOT EXISTS asset_lot_size NUMERIC(20,8) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS asset_price_updated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalog_items_asset_class_check'
  ) THEN
    ALTER TABLE catalog_items
      ADD CONSTRAINT catalog_items_asset_class_check
      CHECK (asset_class IS NULL OR asset_class IN ('stock', 'crypto', 'property', 'gold'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalog_items_asset_lot_size_check'
  ) THEN
    ALTER TABLE catalog_items
      ADD CONSTRAINT catalog_items_asset_lot_size_check
      CHECK (asset_lot_size > 0);
  END IF;
END $$;

-- Asset Console selalu memfilter per bisnis + asset_class NOT NULL.
CREATE INDEX IF NOT EXISTS idx_catalog_items_asset_class
  ON catalog_items(business_id, asset_class)
  WHERE asset_class IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN catalog_items.asset_class IS
  'Kelas aset investasi (stock|crypto|property|gold). NULL = item katalog biasa, tidak muncul di Asset Console.';
COMMENT ON COLUMN catalog_items.asset_lot_size IS
  'Jumlah satuan harga (catalog_items.unit) per 1 kuantitas transaksi. Saham IDX = 100 (1 lot = 100 lembar). Default 1.';
COMMENT ON COLUMN catalog_items.asset_price_updated_at IS
  'Kapan default_price terakhir di-update sebagai harga pasar (input manual, Fase 1 tanpa live feed).';

-- ── 2. Backfill asset_class untuk instrumen yang sudah jelas ────────────────
-- Deterministik dari data, bukan hardcode ID: item yang transaksinya mencatat
-- kuantitas dalam satuan lot ('Lot BMRI', 'Lot BBCA') pasti saham. Motor
-- (Beat/PCX/NMAX/Scoopy) unit_breakdown-nya NULL → tidak tersentuh.
UPDATE catalog_items ci
SET asset_class = 'stock',
    asset_lot_size = 100,
    asset_price_updated_at = ci.updated_at
WHERE ci.asset_class IS NULL
  AND ci.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.deleted_at IS NULL
      AND (t.meta->'catalog_item'->>'id')::uuid = ci.id
      AND t.meta->'unit_breakdown'->>'unit' ILIKE 'Lot %'
  );

-- ── 3. Backfill meta.catalog_item pada transaksi JUAL ───────────────────────
-- Trigger user dimatikan mengikuti preseden migrasi 119: backfill tidak boleh
-- menimpa updated_at/updated_by (auth.uid() NULL di konteks migrasi) dan tidak
-- perlu membanjiri audit_log dengan entry meta-only.
ALTER TABLE transactions DISABLE TRIGGER USER;

-- Jalur A — via meta.sold_stock_ids (pola InventoryPicker yang sudah ada).
-- Transaksi jual menunjuk transaksi beli yang cost basis-nya dilepas; instrumen
-- diambil dari sana. Syarat: SEMUA beli yang dirujuk menunjuk item yang sama
-- (HAVING count(DISTINCT)=1) — kalau jual campuran lintas instrumen, dilewat
-- dan ditangani manual, jangan menebak.
WITH sell_target AS (
  SELECT t.id AS tx_id,
         min((b.meta->'catalog_item'->>'id')) AS item_id
  FROM transactions t
  CROSS JOIN LATERAL jsonb_array_elements_text(t.meta->'sold_stock_ids') AS s(buy_id)
  JOIN transactions b ON b.id = s.buy_id::uuid
  WHERE t.deleted_at IS NULL
    AND NOT COALESCE(t.meta, '{}'::jsonb) ? 'catalog_item'
    AND jsonb_typeof(t.meta->'sold_stock_ids') = 'array'
    AND b.meta ? 'catalog_item'
  GROUP BY t.id
  HAVING count(DISTINCT b.meta->'catalog_item'->>'id') = 1
)
UPDATE transactions t
SET meta = COALESCE(t.meta, '{}'::jsonb)
        || jsonb_build_object('catalog_item',
             jsonb_build_object('id', ci.id, 'name', ci.name))
FROM sell_target st
JOIN catalog_items ci ON ci.id = st.item_id::uuid
WHERE t.id = st.tx_id;

-- Jalur B — fallback untuk jual lama yang tidak punya sold_stock_ids.
-- Cocokkan deskripsi dengan nama item ber-asset_class, dan HANYA bila persis
-- satu item yang cocok (word boundary). Ini perbaikan data satu kali untuk
-- record legacy, bukan logic klasifikasi runtime — kode aplikasi tetap
-- mengandalkan meta.catalog_item yang eksplisit.
WITH candidate AS (
  SELECT t.id AS tx_id,
         min(ci.id::text) AS item_id,
         count(*) AS match_count
  FROM transactions t
  JOIN catalog_items ci
    ON ci.business_id = t.business_id
   AND ci.deleted_at IS NULL
   AND ci.asset_class IS NOT NULL
   AND t.description ~* ('\m' || regexp_replace(ci.name, '([\.\*\+\?\(\)\[\]\{\}\\\|\^\$])', '\\\1', 'g') || '\M')
  WHERE t.deleted_at IS NULL
    AND t.category = 'EARN'
    AND NOT COALESCE(t.meta, '{}'::jsonb) ? 'catalog_item'
  GROUP BY t.id
)
UPDATE transactions t
SET meta = COALESCE(t.meta, '{}'::jsonb)
        || jsonb_build_object('catalog_item',
             jsonb_build_object('id', ci.id, 'name', ci.name))
FROM candidate c
JOIN catalog_items ci ON ci.id = c.item_id::uuid
WHERE t.id = c.tx_id
  AND c.match_count = 1;

ALTER TABLE transactions ENABLE TRIGGER USER;

COMMIT;
