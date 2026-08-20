-- Migration 138: Override manual warna teks chip tim (lanjutan migr 136 & 137)
--
-- Owner ingin bisa memaksa chip nama tim pakai teks hitam atau putih sendiri,
-- bukan cuma menerima hasil hitungan kontras otomatis (readableTextColor).
-- Kasus nyata: warna tim borderline di mana hitungan kontras "benar secara
-- angka" tapi rasa visualnya beda dari selera owner.
--
-- Bentuknya disamakan dengan team_colors: JSONB, key = NOMOR TIM ("1", "2",
-- ...), bukan tabel terpisah — alasan sama seperti team_labels/team_colors,
-- tim bukan entitas berdiri sendiri, cuma properti sesi.
--
-- Kosong / tidak diisi = warna teks dihitung otomatis dari kontras
-- (readableTextColor di colorUtils.ts). Nilai eksplisit HANYA "light" atau
-- "dark" (bukan hex) — override-nya soal pilihan hitam/putih, bukan warna
-- bebas; menyimpan hex di sini akan membuka kemungkinan owner menaruh warna
-- teks yang sama sekali tidak terbaca tanpa pengaman kontras apa pun.

ALTER TABLE event_sessions
  ADD COLUMN IF NOT EXISTS team_text_colors JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN event_sessions.team_text_colors IS
  'Override manual warna teks chip tim, key = nomor tim (sejajar team_colors): {"1":"light"}. Nilai "light"|"dark". Kosong = dihitung otomatis dari kontras (readableTextColor).';

SELECT 'Migration 138 complete - event_sessions.team_text_colors' AS status;
