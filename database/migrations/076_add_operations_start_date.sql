-- Migration 076: Add operations_start_date to businesses
--
-- Memungkinkan user menandai kapan bisnis mulai beroperasi (berbeda dengan
-- tanggal pembuatan record atau tanggal transaksi pertama). Dipakai oleh
-- dashboard untuk menghitung periode ROI:
--   - Jika operations_start_date di-set → ROI dihitung sejak tanggal tsb
--     (operating period ROI)
--   - Jika NULL → fallback ke tanggal transaksi pertama (holding period return)

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS operations_start_date DATE NULL;

COMMENT ON COLUMN businesses.operations_start_date IS
  'Tanggal bisnis mulai beroperasi. Jika di-set, periode ROI di dashboard dihitung dari tanggal ini, bukan dari tanggal transaksi pertama.';
