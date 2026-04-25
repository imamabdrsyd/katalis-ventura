-- Migration: Tambah konfigurasi widget Jasa di halaman publik
-- widget_date_mode: 'single' (1 tanggal) atau 'double' (check-in + check-out)
-- widget_labels: JSONB dengan label-label form yang bisa dikustomisasi

ALTER TABLE business_omni_channels
  ADD COLUMN IF NOT EXISTS widget_date_mode TEXT NOT NULL DEFAULT 'double'
    CHECK (widget_date_mode IN ('single', 'double')),
  ADD COLUMN IF NOT EXISTS widget_labels JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Contoh isi widget_labels:
-- {
--   "date_label": "Tanggal Kunjungan",       -- untuk mode single
--   "checkin_label": "Check-in",              -- untuk mode double
--   "checkout_label": "Check-out",            -- untuk mode double
--   "note_label": "Catatan (opsional)",
--   "note_placeholder": "misal: 2 tamu, butuh parkir",
--   "cta_label": "Kirim rencana via WhatsApp",
--   "action_label": "kunjungan"               -- dipakai di pesan WA
-- }
