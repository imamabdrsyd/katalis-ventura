-- Migration 144: Jam & lokasi event (lanjutan migr 136)
--
-- Baris kedua header "Players Lobby" sebelumnya mengulang session.title —
-- informasi yang sudah dibaca pendaftar di layar sebelumnya. Yang benar-benar
-- belum dia tahu saat memilih slot justru DI MANA dan JAM BERAPA, jadi baris
-- itu sekarang dipakai untuk jam + lokasi dan title turun jadi cadangan.
--
-- Per SESI, bukan per tanggal kandidat: crowdtesting-nya soal "tanggal mana
-- yang paling banyak orangnya", bukan "lokasi mana". Satu event = satu tempat
-- & satu jam main; yang divariasikan cuma harinya. Kalau suatu saat perlu jam
-- berbeda per tanggal, kolom senama bisa ditambahkan di event_session_dates
-- sebagai override tanpa membatalkan kolom di sini.
--
-- start_time/end_time TIME (bukan TEXT): dipilih lewat time picker, dirender
-- klien sebagai "19:00–21:00". end_time NULL = acara tanpa jam selesai pasti,
-- ditampilkan "19:00" saja — dibedakan dari end_time yang diisi sama dengan
-- start_time. location TEXT bebas: nama tempat, bukan alamat terstruktur.

ALTER TABLE event_sessions
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time   TIME,
  ADD COLUMN IF NOT EXISTS location   TEXT;

ALTER TABLE event_sessions
  ADD CONSTRAINT event_sessions_location_length CHECK (char_length(location) <= 120);

-- end_time tanpa start_time tidak punya arti yang bisa ditampilkan.
ALTER TABLE event_sessions
  ADD CONSTRAINT event_sessions_end_time_needs_start
    CHECK (end_time IS NULL OR start_time IS NOT NULL);

COMMENT ON COLUMN event_sessions.start_time IS
  'Jam mulai event. NULL = tidak ditampilkan di baris kedua Lobby.';
COMMENT ON COLUMN event_sessions.end_time IS
  'Jam selesai event (opsional). NULL = tampil jam mulai saja. Wajib NULL bila start_time NULL.';
COMMENT ON COLUMN event_sessions.location IS
  'Nama lokasi event (mis. "GOR Sukapura"). NULL/kosong = tidak ditampilkan.';

SELECT 'Migration 144 complete - event_sessions.start_time/end_time/location' AS status;
