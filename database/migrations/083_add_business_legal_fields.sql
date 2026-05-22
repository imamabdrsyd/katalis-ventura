-- Migration 083: Add legal/registration fields to businesses
--
-- Menambah informasi legal entity yang sering dibutuhkan untuk
-- compliance, invoice, dan dokumen resmi:
--   - legal_name           → Nama legal sesuai akta (misal "PT Elvéa Indonesia")
--   - legal_entity_type    → Bentuk badan usaha (PT, CV, UD, Perorangan, dst.)
--   - registered_address   → Alamat terdaftar pada akta / izin usaha
--
-- Semua nullable agar tidak memaksa bisnis lama untuk mengisi.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS legal_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS legal_entity_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS registered_address TEXT NULL;

COMMENT ON COLUMN businesses.legal_name IS
  'Nama legal bisnis sesuai akta/registrasi (mis. "PT Elvéa Indonesia").';
COMMENT ON COLUMN businesses.legal_entity_type IS
  'Bentuk badan usaha: PT, CV, UD, Firma, Koperasi, Yayasan, Perorangan, dll.';
COMMENT ON COLUMN businesses.registered_address IS
  'Alamat terdaftar bisnis pada akta atau izin usaha.';
