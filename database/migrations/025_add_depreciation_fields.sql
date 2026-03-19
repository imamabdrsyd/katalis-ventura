-- Migration 025: Add depreciation fields to accounts table
-- Implements straight-line depreciation per PSAK 16 / IAS 16
-- Fields only relevant for ASSET accounts with default_category = 'CAPEX'

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS useful_life_months INTEGER;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS residual_value NUMERIC DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS depreciation_method TEXT DEFAULT 'straight_line';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS acquisition_date DATE;

-- Add check constraint: useful_life_months must be positive if set
ALTER TABLE accounts ADD CONSTRAINT check_useful_life_positive
  CHECK (useful_life_months IS NULL OR useful_life_months > 0);

-- Add check constraint: residual_value must be non-negative
ALTER TABLE accounts ADD CONSTRAINT check_residual_value_non_negative
  CHECK (residual_value IS NULL OR residual_value >= 0);

COMMENT ON COLUMN accounts.useful_life_months IS 'Masa manfaat aset dalam bulan (straight-line depreciation)';
COMMENT ON COLUMN accounts.residual_value IS 'Nilai residu aset setelah masa manfaat habis';
COMMENT ON COLUMN accounts.depreciation_method IS 'Metode penyusutan: straight_line (default, satu-satunya yang didukung saat ini)';
COMMENT ON COLUMN accounts.acquisition_date IS 'Tanggal perolehan aset tetap';
