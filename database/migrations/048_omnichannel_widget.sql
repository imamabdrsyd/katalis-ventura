-- Migration 048: Omnichannel Widget di Landing Page
-- Menambahkan kolom konfigurasi widget WhatsApp + opt-in tampilkan di landing page Axion.
-- Catatan kompatibilitas:
--   * "Sektor" sudah ada di kolom businesses.business_type (agribusiness, accommodation, dll).
--   * "Tipe bisnis" (Jasa/Produk/Dagang) sudah ada di businesses.business_category (migrasi 016).
--   * Kolom logo_url sudah ada (migrasi 018).

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS widget_action_label TEXT DEFAULT 'kunjungan',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN businesses.city IS 'Kota lokasi bisnis untuk widget omnichannel di landing page';
COMMENT ON COLUMN businesses.whatsapp_number IS 'Nomor WA format internasional tanpa + (contoh: 6281234567890)';
COMMENT ON COLUMN businesses.widget_action_label IS 'Label aksi di widget (contoh: menginap, konsultasi, booking)';
COMMENT ON COLUMN businesses.is_public IS 'Apakah bisnis ditampilkan di landing page Axion (omnichannel widget)';

-- Index untuk query landing page
CREATE INDEX IF NOT EXISTS idx_businesses_is_public ON businesses(is_public) WHERE is_public = TRUE;
