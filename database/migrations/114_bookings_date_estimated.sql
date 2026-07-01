-- Migration 114: bookings.date_estimated
-- Menandai booking hasil rekonsiliasi/backfill dari transaksi revenue lama yang
-- hanya punya jumlah malam (bukan tanggal check-in pasti). Untuk booking seperti
-- ini, check-in di-default ke tanggal transaksi (perkiraan) dan ditandai
-- date_estimated=true agar owner tahu perlu dikoreksi di kalender. Begitu tanggal
-- diedit manual, flag di-clear (payment/booking data lain tak berubah).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS date_estimated BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN bookings.date_estimated IS 'true = tanggal check-in perkiraan (dari tanggal transaksi saat backfill), perlu konfirmasi owner';
