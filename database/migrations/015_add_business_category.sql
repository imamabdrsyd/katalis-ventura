-- Migration 015: Add business_category column to businesses table
-- business_type = sector (Agribusiness, F&B, etc.)
-- business_category = type of business (Jasa, Produk, Dagang)

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS business_category TEXT;

COMMENT ON COLUMN businesses.business_category IS 'Tipe bisnis: jasa, produk, dagang';