-- Migration 118: Kalender = read-model — booking bersumber dari transaksi & omnichannel
--
-- Keputusan produk (05 Jul 2026): input booking TIDAK lewat kalender (kalender =
-- tampilan owner/investor). Booking mengalir dari dua sumber:
--   1. Transaksi EARN yang di-flag user ("Masukkan ke kalender") → status LUNAS.
--      Transaksi tidak punya tanggal check-in/out → booking masuk PENAMPUNGAN
--      (holding) dulu: check_in/check_out NULL, ditindaklanjuti owner di halaman
--      kalender (panel "Perlu tindak lanjut") untuk diisi tanggalnya.
--   2. Widget omnichannel (halaman publik /[slug]) saat calon tamu klik CTA cek
--      ketersediaan → booking TENTATIF dengan tanggal dari widget, channel
--      'website'. Follow-up terjadi di WhatsApp (di luar sistem) — owner update
--      status manual.
--
-- Perubahan skema:
--   (1) check_in/check_out nullable — NULL = booking di penampungan (belum ada
--       tanggal). Harus berpasangan: dua-duanya NULL atau dua-duanya terisi.
--   (2) Exclusion constraint anti double-booking ditambah guard check_in IS NOT
--       NULL — daterange(NULL,NULL) = rentang unbounded yang overlap semua.
--   (3) channel CHECK ditambah 'website' (inquiry dari widget omnichannel).

-- (1) Tanggal nullable + wajib berpasangan
ALTER TABLE bookings ALTER COLUMN check_in DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN check_out DROP NOT NULL;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_dates_pair CHECK ((check_in IS NULL) = (check_out IS NULL));

COMMENT ON COLUMN bookings.check_in IS 'NULL = booking di penampungan (menunggu owner isi tanggal, mis. hasil flag transaksi EARN)';

-- (2) Rebuild exclusion constraint dengan guard NULL
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_double_booking;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_double_booking
  EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in, check_out) WITH &&
  )
  WHERE (
    NOT is_external AND status <> 'cancelled' AND deleted_at IS NULL
    AND NOT date_estimated AND check_in IS NOT NULL
  );

-- (3) Channel 'website' untuk inquiry widget omnichannel
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_channel_check;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_channel_check
  CHECK (channel = ANY (ARRAY['manual', 'airbnb', 'booking_com', 'website', 'other']));

-- ============================================================
-- ROLLBACK (manual):
-- (pastikan tak ada baris check_in NULL / channel 'website' dulu)
-- ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_dates_pair;
-- ALTER TABLE bookings ALTER COLUMN check_in SET NOT NULL;
-- ALTER TABLE bookings ALTER COLUMN check_out SET NOT NULL;
-- (rebuild exclusion & channel check versi migr 117)
-- ============================================================
