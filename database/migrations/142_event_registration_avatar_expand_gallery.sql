-- Migration 142: Sinkronkan galeri avatar (lanjutan migr 140)
--
-- User menambah 5 avatar baru ke public/persona/ (persona-3..7) dan menolak
-- 'agent.png' sebagai opsi avatar pemain event (21 Agustus 2026) — ikon
-- orchestrator AXION Agent tidak cocok jadi wajah pemain padel. CHECK
-- constraint di sini diselaraskan ulang dengan katalog
-- `src/lib/events/avatars.ts` (EVENT_AVATAR_OPTIONS) — dua tempat itu WAJIB
-- selalu sinkron, sama seperti dicatat di migrasi 140.
--
-- DROP + ADD (bukan sekali ALTER) karena Postgres tidak punya sintaks
-- "ganti isi CHECK constraint" langsung — constraint lama harus dibuang dulu.

ALTER TABLE event_registrations
  DROP CONSTRAINT event_registrations_avatar_key_valid;

ALTER TABLE event_registrations
  ADD CONSTRAINT event_registrations_avatar_key_valid
  CHECK (avatar_key IS NULL OR avatar_key IN (
    'persona-1', 'persona-2', 'persona-3', 'persona-4', 'persona-5', 'persona-6', 'persona-7',
    'bianca', 'concierge', 'sri-mulyani', 'stanley'
  ));

SELECT 'Migration 142 complete - event_registrations_avatar_key_valid expanded (persona-3..7, agent removed)' AS status;
