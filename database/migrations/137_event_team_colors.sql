-- Migration 137: Warna identitas per tim untuk Event Registration (lanjutan migr 136)
--
-- Owner event ingin tiap tim punya warna sendiri (Tim Elang plum, Tim Garuda
-- hitam, dst) supaya Lobby publik terbaca seperti materi promosi mereka, bukan
-- indigo AXION.
--
-- Bentuknya sengaja disamakan dengan `team_labels`: JSONB dengan key = NOMOR TIM
-- ("1", "2", ...), bukan tabel terpisah. Alasannya sama seperti team_labels —
-- jumlah tim itu properti sesi (`team_count`), jadi tim bukan entitas yang
-- berdiri sendiri dan tidak punya siklus hidup di luar sesinya.
--
-- Kosong / tidak diisi = tim mewarisi warna brand halaman publik
-- (`business_omni_channels.button_color`), yang defaultnya indigo #6366f1.
-- Jangan menaruh default warna di kolom ini: nilai kosong itu bermakna
-- "ikut brand", beda dari "kebetulan warnanya indigo".

ALTER TABLE event_sessions
  ADD COLUMN IF NOT EXISTS team_colors JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN event_sessions.team_colors IS
  'Warna identitas per tim, key = nomor tim (sejajar team_labels): {"1":"#9B6A8F"}. Kosong = ikut warna brand halaman publik (business_omni_channels.button_color).';

SELECT 'Migration 137 complete - event_sessions.team_colors' AS status;
