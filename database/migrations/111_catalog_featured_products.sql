-- Migration 111: Produk Unggulan wired ke katalog
--
-- Sebelumnya "Produk Unggulan" di omni-channel adalah SATU produk yang diketik
-- manual (kolom JSONB `featured_product`). Sekarang widget ini menjadi wire dari
-- item katalog: user memilih item katalog mana yang ditampilkan di halaman publik.
--
-- Konsekuensi:
-- 1. Konfigurasi kaya (foto, crop/focal point, link CTA) PINDAH dari widget ke
--    item katalog itu sendiri → tambah kolom di `catalog_items`.
-- 2. Omni-channel menyimpan daftar id item yang dipilih → `featured_item_ids`.
--
-- Kolom JSONB lama `featured_product` SENGAJA TIDAK dihapus (back-compat data &
-- rollback aman); tidak lagi ditulis/dibaca oleh kode baru.

-- ── 1. Rich config pindah ke catalog_items ──────────────────────────────────
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_fit TEXT
    CHECK (image_fit IN ('cover', 'contain')),
  ADD COLUMN IF NOT EXISTS image_position_x SMALLINT
    CHECK (image_position_x BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS image_position_y SMALLINT
    CHECK (image_position_y BETWEEN 0 AND 100),
  -- Link CTA opsional (mis. Shopee/Tokopedia). Jika kosong, klik produk di
  -- halaman publik jatuh ke chat WhatsApp bisnis dgn pesan menyebut nama produk.
  ADD COLUMN IF NOT EXISTS link_url TEXT,
  ADD COLUMN IF NOT EXISTS link_label TEXT;

-- ── 2. Daftar item katalog yang difitur di omni-channel ─────────────────────
ALTER TABLE business_omni_channels
  ADD COLUMN IF NOT EXISTS featured_item_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN business_omni_channels.featured_item_ids IS
  'Urutan item katalog yang ditampilkan sebagai Produk Unggulan di halaman publik. Kosong = widget tidak tampil.';
