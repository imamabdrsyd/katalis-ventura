-- Migration 104: business_ai_knowledge.fields
-- Tambah kolom terstruktur (JSONB) untuk fakta bisnis ringkas yang sering ditanya
-- calon pelanggan: jam buka (hours), lokasi (location), kebijakan (policies), FAQ.
-- Diedit lewat editor terpisah di panel Info AI; ditampilkan sebagai ringkasan di
-- atas catatan bebas (`content`). AI membaca keduanya (fields + content).
--
-- Bentuk: { "hours": "...", "location": "...", "policies": "...", "faq": "..." }
-- Semua opsional. Default '{}' = belum diisi (panel tampil seperti hanya textarea).

ALTER TABLE business_ai_knowledge
  ADD COLUMN IF NOT EXISTS fields JSONB NOT NULL DEFAULT '{}'::jsonb;
