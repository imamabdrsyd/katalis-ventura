-- Migration 143: Cabut 'stanley' dari galeri avatar (lanjutan migr 140 & 142)
--
-- Alasannya bukan soal aset melainkan LAYOUT: dengan 11 opsi, picker avatar di
-- modal pendaftaran jatuh jadi 3 baris (5+5+1) dan modalnya kelewat tinggi di
-- layar HP. Dipangkas ke 10 supaya rapi 2 baris × 5.
--
-- Aman dijalankan karena semua baris yang memakai 'stanley' sudah dihapus lebih
-- dulu (2 baris data uji, dikonfirmasi user). Kalau nanti ada environment lain
-- yang masih menyimpan nilai itu, ALTER ini akan GAGAL — itu disengaja: lebih
-- baik migrasinya berhenti daripada diam-diam menyisakan baris yang melanggar
-- constraint. Bersihkan dulu barisnya, baru jalankan ulang.
--
-- Set di sini WAJIB sinkron dengan EVENT_AVATAR_OPTIONS di
-- `src/lib/events/avatars.ts`.

ALTER TABLE event_registrations
  DROP CONSTRAINT event_registrations_avatar_key_valid;

ALTER TABLE event_registrations
  ADD CONSTRAINT event_registrations_avatar_key_valid
  CHECK (avatar_key IS NULL OR avatar_key IN (
    'persona-1', 'persona-2', 'persona-3', 'persona-4', 'persona-5', 'persona-6', 'persona-7',
    'bianca', 'concierge', 'sri-mulyani'
  ));

SELECT 'Migration 143 complete - stanley dicabut dari galeri avatar (10 opsi tersisa)' AS status;
