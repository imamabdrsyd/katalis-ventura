-- Migration 139: Label eyebrow bisa diedit admin (lanjutan migr 136)
--
-- "Book Your Spot" sebelumnya teks tetap (hardcode) di kartu halaman publik
-- dan header Lobby. Owner mungkin mau bahasa lain ("Pendaftaran Dibuka",
-- "Daftar Sekarang") atau menyesuaikan gaya bahasa bisnisnya sendiri.
--
-- Kolom TEXT biasa (bukan JSONB seperti team_labels/team_colors) karena ini
-- properti SATU sesi, bukan per-tim. NULL/kosong = fallback ke default
-- aplikasi "Book Your Spot" — bedakan dari string kosong yang disengaja
-- (owner tidak bisa "mengosongkan" label ini sepenuhnya lewat UI; field
-- kosong di form selalu dianggap "pakai default", bukan "sembunyikan label").

ALTER TABLE event_sessions
  ADD COLUMN IF NOT EXISTS eyebrow_text TEXT;

ALTER TABLE event_sessions
  ADD CONSTRAINT event_sessions_eyebrow_text_length CHECK (char_length(eyebrow_text) <= 40);

COMMENT ON COLUMN event_sessions.eyebrow_text IS
  'Label kecil di atas judul kartu & Lobby publik (mis. "Book Your Spot", "Pendaftaran Dibuka"). NULL/kosong = pakai default aplikasi "Book Your Spot".';

SELECT 'Migration 139 complete - event_sessions.eyebrow_text' AS status;
