-- Migration 049: Gallery Showcase untuk Omni-Channel
-- Menambah kolom gallery_images JSONB ke business_omni_channels.
-- Format: array of { path: string, url: string, sort_order: number }
--   * path  → storage path untuk delete via supabase.storage.remove()
--   * url   → public URL untuk render di landing page
--   * sort_order → urutan tampil (0-based)

ALTER TABLE business_omni_channels
  ADD COLUMN IF NOT EXISTS gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN business_omni_channels.gallery_images IS
  'Array of { path, url, sort_order } untuk gallery showcase di landing page Axion';
