-- Migration 141: Satu kontak = satu slot per tanggal (lanjutan migr 136)
--
-- Keputusan eksplisit user: "1 org gabisa berperan jadi 2 pemain di satu
-- tanggal yang sama". Ini MENGGANTI perilaku lama — sebelumnya route publik
-- (`MAX_SLOTS_PER_CONTACT = 6`) sengaja mengizinkan pola "kapten tim
-- mendaftarkan semua rekannya pakai kontaknya sendiri". Pola itu sekarang
-- TIDAK didukung lagi: tiap slot wajib kontak (WA/IG) uniknya sendiri per
-- tanggal, supaya (a) hitungan "X/12 terisi" mencerminkan orang unik, dan
-- (b) manager benar-benar bisa follow-up tiap pemain lewat kontak masing-
-- masing, bukan satu kontak mewakili banyak "pemain hantu".
--
-- Index unik parsial, pola sama persis dengan `event_registrations_slot_unique`
-- (migr 136): backstop DB-level yang jadi wasit sesungguhnya untuk race 2
-- submit hampir bersamaan dari kontak yang sama — pre-check di route publik
-- (`app/api/public/events/register/route.ts`) cuma UX (pesan error cepat
-- sebelum sempat ke RPC), bukan penjaga utama.
--
-- Lintas TANGGAL sengaja TIDAK dibatasi (keputusan eksplisit user juga) —
-- kontak yang sama boleh ambil slot di beberapa tanggal kandidat berbeda
-- dalam satu event yang sama, sambil menunggu manager memutuskan pemenangnya.

CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_contact_per_date_unique
  ON event_registrations (session_date_id, contact_value)
  WHERE status <> 'cancelled';

SELECT 'Migration 141 complete - event_registrations_contact_per_date_unique' AS status;
