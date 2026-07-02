-- Migration 115: Kalender — flag unit bookable + proteksi double-booking di DB
--
-- (1) catalog_items.is_bookable_unit
--     Item katalog bisnis akomodasi bisa berupa kamar/villa (unit bookable)
--     ATAU rate plan/add-on (mis. "Cleaning Service", "Monthly Rent") yang
--     TIDAK boleh dihitung sebagai unit di denominator occupancy/RevPAR dan
--     tidak relevan di dropdown unit BookingModal. Flag eksplisit — bukan
--     klasifikasi keyword nama/satuan. Default TRUE = perilaku lama; owner
--     meng-uncheck item non-kamar via form Katalog (muncul hanya utk sektor
--     akomodasi).
--
-- (2) bookings_no_double_booking (EXCLUDE USING gist, butuh btree_gist)
--     Dua booking aktif (bukan cancelled / soft-deleted / blok OTA eksternal)
--     untuk catalog_item_id yang sama tidak boleh beririsan tanggal
--     [check_in, check_out). Backstop server-side untuk cek overlap client
--     (findOverlappingBookings) yang debounced & rawan race dua sesi simultan.
--
--     Catatan:
--     * catalog_item_id NULL tidak saling match (semantik NULL seperti UNIQUE)
--       → booking tanpa unit (hasil backfill saat multi-unit) tidak dibatasi,
--       konsisten dengan cek client yang juga per-unit. Diverifikasi 03 Juli
--       2026: seluruh 64 booking existing ber-catalog_item_id NULL, tidak ada
--       yang melanggar constraint saat dipasang.
--     * Blok eksternal (is_external) dikecualikan: feed OTA sah beririsan
--       dengan booking langsung (loop ekspor→impor kalender).
--     * Pelanggaran memunculkan SQLSTATE 23P01 — dipetakan ke pesan ramah di
--       src/lib/api/bookings.ts.

ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS is_bookable_unit BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN catalog_items.is_bookable_unit IS
  'Dihitung sebagai unit kamar di kalender booking (dropdown unit + denominator occupancy). FALSE untuk rate plan/add-on.';

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_double_booking
  EXCLUDE USING gist (
    catalog_item_id WITH =,
    daterange(check_in, check_out) WITH &&
  )
  WHERE (NOT is_external AND status <> 'cancelled' AND deleted_at IS NULL);

COMMENT ON CONSTRAINT bookings_no_double_booking ON bookings IS
  'Anti double-booking per unit: booking aktif non-eksternal tidak boleh beririsan tanggal [check_in, check_out).';

-- ============================================================
-- ROLLBACK (jalankan manual jika perlu revert):
-- ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_double_booking;
-- ALTER TABLE catalog_items DROP COLUMN IF EXISTS is_bookable_unit;
-- ============================================================
