-- Tambah kolom subtitle pada link omni-channel
-- Baris kedua yang tampil di halaman publik, bisa diisi user bebas
ALTER TABLE business_omni_channel_links
  ADD COLUMN IF NOT EXISTS subtitle TEXT;
