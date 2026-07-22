-- Migration 124: Base price per-unit dari service item (weekday/weekend/monthly)
-- ============================================================================
-- Model baru harga kalender akomodasi:
--   - catalog_items.unit_id  : scope layanan per unit fisik (business_units).
--                              NULL = milik bisnis (produk/dagang & add-on lintas unit).
--   - catalog_items.service_role : 'main' (sewa kamar) vs 'addon' (mis. Cleaning).
--                              NULL untuk produk / non-akomodasi.
--   - catalog_items.rate_kind : 'weekday'|'weekend'|'monthly' — hanya bila service_role='main'.
--                              Menyetir base price grid kalender & widget publik:
--                              weekday→Sen–Jum, weekend→Sab+Min (fallback weekday bila tak ada),
--                              monthly→acuan long-stay (>27 malam) di halaman publik.
--
-- Harga dasar kini dihitung dari item main-service per kategori (bukan lagi dari
-- business_units.rate_item_id yang flat). Override per tanggal (unit_daily_rates)
-- tetap menang. business_units.rate_item_id DIBIARKAN (deprecated) — tak dihapus
-- agar tak perlu migrasi berisiko & menyentuh banyak konsumen sekaligus.
-- ============================================================================

ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES business_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_role TEXT CHECK (service_role IN ('main', 'addon')),
  ADD COLUMN IF NOT EXISTS rate_kind TEXT CHECK (rate_kind IN ('weekday', 'weekend', 'monthly'));

COMMENT ON COLUMN catalog_items.unit_id IS
  'Unit fisik (business_units) pemilik layanan ini. NULL = milik bisnis (produk / add-on lintas unit).';
COMMENT ON COLUMN catalog_items.service_role IS
  'main = sewa kamar (menyetir base price), addon = layanan tambahan (mis. Cleaning). NULL untuk produk.';
COMMENT ON COLUMN catalog_items.rate_kind IS
  'weekday|weekend|monthly — kategori base price. Hanya untuk service_role=main; NULL selain itu.';

CREATE INDEX IF NOT EXISTS idx_catalog_items_unit
  ON catalog_items(unit_id) WHERE deleted_at IS NULL;

-- Satu unit hanya boleh punya satu item main per kategori rate (weekday/weekend/monthly).
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_items_unit_rate_kind
  ON catalog_items(unit_id, rate_kind)
  WHERE service_role = 'main' AND rate_kind IS NOT NULL AND deleted_at IS NULL;

-- ── Backfill data akomodasi existing ───────────────────────────────────────
-- 1) Assign semua catalog item bisnis akomodasi ke unit pertama (sort_order terkecil).
UPDATE catalog_items ci
SET unit_id = u.unit_id
FROM (
  SELECT DISTINCT ON (bu.business_id) bu.business_id, bu.id AS unit_id
  FROM business_units bu
  WHERE bu.deleted_at IS NULL AND bu.is_active
  ORDER BY bu.business_id, bu.sort_order ASC, bu.created_at ASC
) u
JOIN businesses b ON b.id = u.business_id
WHERE ci.business_id = u.business_id
  AND ci.deleted_at IS NULL
  AND ci.unit_id IS NULL
  AND ci.item_type = 'service'
  AND b.business_sector IN ('accommodation', 'short_term_rental');

-- 2) Tag rate_kind + service_role dari nama existing (data real Hillside).
UPDATE catalog_items ci
SET service_role = 'main',
    rate_kind = CASE
      WHEN ci.name ILIKE '%weekend%' THEN 'weekend'
      WHEN ci.name ILIKE '%month%'   THEN 'monthly'
      WHEN ci.name ILIKE '%weekday%' OR ci.name ILIKE '%daily%' THEN 'weekday'
      ELSE NULL
    END
FROM businesses b
WHERE ci.business_id = b.id
  AND ci.deleted_at IS NULL
  AND ci.item_type = 'service'
  AND ci.unit_id IS NOT NULL
  AND b.business_sector IN ('accommodation', 'short_term_rental')
  AND (ci.name ILIKE '%weekend%' OR ci.name ILIKE '%month%'
       OR ci.name ILIKE '%weekday%' OR ci.name ILIKE '%daily%');

-- 3) Sisa item service akomodasi (mis. "Cleaning Service") = add-on.
UPDATE catalog_items ci
SET service_role = 'addon', rate_kind = NULL
FROM businesses b
WHERE ci.business_id = b.id
  AND ci.deleted_at IS NULL
  AND ci.item_type = 'service'
  AND ci.unit_id IS NOT NULL
  AND ci.service_role IS NULL
  AND b.business_sector IN ('accommodation', 'short_term_rental');
