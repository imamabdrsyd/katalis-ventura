-- Migration 062: Visibility toggle per widget di halaman publik omni-channel
-- Creator bisa memilih widget mana yang ditampilkan ke pengunjung.

ALTER TABLE business_omni_channels
  ADD COLUMN IF NOT EXISTS show_gallery   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_showcase  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_widget    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_links     BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN business_omni_channels.show_gallery  IS 'Tampilkan gallery carousel di halaman publik';
COMMENT ON COLUMN business_omni_channels.show_showcase IS 'Tampilkan showcase image di halaman publik';
COMMENT ON COLUMN business_omni_channels.show_widget   IS 'Tampilkan widget reservasi/link-cards di halaman publik';
COMMENT ON COLUMN business_omni_channels.show_links    IS 'Tampilkan daftar link di halaman publik';
