-- Migration 061: Showcase images & layout selector untuk halaman publik omni-channel
--
-- 1. showcase_images JSONB — array gambar yang tampil sesuai ratio aslinya
--    (object-contain, tidak di-crop). Berbeda dengan gallery_images yang dipotong square.
--    Format: array of { path, url, sort_order }
--      * path  → cloudinary public_id untuk delete
--      * url   → cloudinary secure_url untuk render
--      * sort_order → urutan tampil (0-based)
--
-- 2. layout_mode TEXT — pilihan tata letak header halaman publik:
--      * 'classic' (default) — banner + profile bulat overlap di bawah banner
--      * 'modern'            — banner besar tanpa bar profile
--      * 'clean'             — banner saja, tanpa profile picture

ALTER TABLE business_omni_channels
  ADD COLUMN IF NOT EXISTS showcase_images JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE business_omni_channels
  ADD COLUMN IF NOT EXISTS layout_mode TEXT NOT NULL DEFAULT 'classic'
  CHECK (layout_mode IN ('classic', 'modern', 'clean'));

COMMENT ON COLUMN business_omni_channels.showcase_images IS
  'Array of { path, url, sort_order } untuk showcase image (tampil dengan ratio asli, tanpa crop)';

COMMENT ON COLUMN business_omni_channels.layout_mode IS
  'Tata letak header halaman publik: classic | modern | clean';
