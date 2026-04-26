-- Migration 053: Rename business_type → business_sector, business_category → business_type
-- Alasan: penamaan kolom lama terbalik dari semantiknya di UI
--   business_type (lama) = sektor bisnis (agribusiness, accommodation, dll) → ganti jadi business_sector
--   business_category (lama) = tipe bisnis (jasa, produk, dagang) → ganti jadi business_type

ALTER TABLE businesses RENAME COLUMN business_type TO business_sector;
ALTER TABLE businesses RENAME COLUMN business_category TO business_type;

COMMENT ON COLUMN businesses.business_sector IS 'Sektor bisnis: agribusiness, food_and_beverage, accommodation, dll';
COMMENT ON COLUMN businesses.business_type IS 'Tipe bisnis: jasa, produk, dagang';
