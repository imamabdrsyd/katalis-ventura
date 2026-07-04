-- Migration 117: business_units — pisahkan "unit fisik bookable" dari "catalog item"
--
-- KOREKSI MODEL: migrasi 113/115/116 keliru memperlakukan catalog_items (layanan/rate
-- plan, mis. "Weekday Daily Rent", "Cleaning Service") sebagai unit fisik yang
-- dibooking. Akibatnya: (a) proteksi double-booking (migr 115) di-scope per
-- catalog_item_id — booking "Weekday Rate" & "Weekend Rate" pada tanggal sama TIDAK
-- saling blok padahal itu properti fisik yang sama; (b) unitsCount occupancy
-- (migr 113/CalendarKpiStrip) dihitung dari jumlah catalog item, bukan unit fisik.
--
-- Model baru:
--   business_units   = properti/kamar/villa fisik yang bisa dibooking. Tiap unit
--                       punya kalender & occupancy sendiri ("kalau ada unit lain,
--                       kalendarnya juga beda"). rate_item_id menunjuk 1 catalog_item
--                       sebagai sumber harga dasar KHUSUS unit ini (per-unit, bukan
--                       per-bisnis — beda unit bisa beda tarif dasar).
--   catalog_items    = tetap murni layanan/rate plan (harga, akun pendapatan) —
--                       TIDAK LAGI berperan sebagai "unit". Flag is_bookable_unit
--                       (migr 115) & ical_import_url (migr 113) dihapus dari sini,
--                       pindah semantik ke business_units.
--   bookings.unit_id  menggantikan bookings.catalog_item_id — booking menaut ke
--                       properti fisik, bukan ke rate plan yang dipakai.
--   unit_daily_rates  di-rekey dari catalog_item_id ke unit_id — override harga
--                       adalah milik kalender unit tsb, bukan milik catalog item
--                       abstrak (2 unit bisa berbagi catalog item rate yang sama
--                       tapi override harganya harus independen).

-- ── Tabel business_units ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Item katalog sumber harga dasar kalender unit ini (opsional; NULL = belum di-set).
  rate_item_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL,
  -- URL feed .ics OTA (Airbnb/Booking.com) untuk impor blok ketersediaan unit ini.
  ical_import_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_business_units_unique_name
  ON business_units(business_id, LOWER(name)) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_units_business ON business_units(business_id) WHERE deleted_at IS NULL;

CREATE TRIGGER update_business_units_updated_at
  BEFORE UPDATE ON business_units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_business_units_updated_by
  BEFORE UPDATE ON business_units
  FOR EACH ROW EXECUTE FUNCTION set_updated_by();

CREATE TRIGGER log_business_units_audit
  AFTER INSERT OR UPDATE OR DELETE ON business_units
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view units of their businesses"
  ON business_units FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

CREATE POLICY "Managers can insert units"
  ON business_units FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid() AND business_id = business_units.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can update units"
  ON business_units FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid() AND business_id = business_units.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can delete units"
  ON business_units FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid() AND business_id = business_units.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- ── Backfill: 1 unit default per bisnis sektor akomodasi ────────────────────
-- Bawa serta rate_item_id dari businesses.calendar_rate_item_id (migr 116, baru
-- dipakai Hillside) supaya kalender harga yang sudah di-set tidak hilang.
INSERT INTO business_units (business_id, name, rate_item_id, is_active, sort_order)
SELECT id, business_name, calendar_rate_item_id, true, 0
FROM businesses
WHERE business_sector IN ('accommodation', 'short_term_rental');

-- ── bookings: unit_id menggantikan catalog_item_id ──────────────────────────
ALTER TABLE bookings ADD COLUMN unit_id UUID REFERENCES business_units(id) ON DELETE SET NULL;

-- Booking existing (semua ber-catalog_item_id NULL) ditaut ke unit default bisnisnya.
UPDATE bookings b
SET unit_id = (
  SELECT bu.id FROM business_units bu
  WHERE bu.business_id = b.business_id
  ORDER BY bu.sort_order, bu.created_at LIMIT 1
);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_double_booking;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_catalog_item_id_fkey;
ALTER TABLE bookings DROP COLUMN IF EXISTS catalog_item_id;

-- Proteksi double-booking di-scope ulang per unit fisik (bukan per rate plan).
-- date_estimated=true DIKECUALIKAN: hasil backfill dari transaksi lama yang cuma
-- tahu jumlah malam (bukan tanggal pasti) — 2 pasang booking legacy ternyata
-- beririsan setelah di-taut ke unit fisik yang sama (tanggal tebakan, BUKAN
-- indikasi Hillside punya >1 unit — diverifikasi 05 Jul 2026, keduanya estimasi).
-- Begitu owner mengoreksi & menyimpan tanggal asli, flag hilang (BookingModal)
-- dan constraint ini langsung berlaku penuh untuk booking tsb.
ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_double_booking
  EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in, check_out) WITH &&
  )
  WHERE (NOT is_external AND status <> 'cancelled' AND deleted_at IS NULL AND NOT date_estimated);

CREATE INDEX idx_bookings_unit_range
  ON bookings(business_id, unit_id, check_in, check_out) WHERE deleted_at IS NULL;

-- ── unit_daily_rates: rekey dari catalog_item_id ke unit_id ─────────────────
-- (0 baris ada saat migrasi ini ditulis — fitur baru dibangun sehari sebelumnya,
-- belum ada override tersimpan; rekey aman tanpa risiko kehilangan data.)
ALTER TABLE unit_daily_rates ADD COLUMN unit_id UUID REFERENCES business_units(id) ON DELETE CASCADE;
UPDATE unit_daily_rates udr
SET unit_id = (SELECT bu.id FROM business_units bu WHERE bu.rate_item_id = udr.catalog_item_id LIMIT 1);
DELETE FROM unit_daily_rates WHERE unit_id IS NULL; -- safety: baris yatim (harusnya nol)
ALTER TABLE unit_daily_rates ALTER COLUMN unit_id SET NOT NULL;
ALTER TABLE unit_daily_rates DROP CONSTRAINT IF EXISTS unit_daily_rates_unique;
ALTER TABLE unit_daily_rates DROP CONSTRAINT IF EXISTS unit_daily_rates_catalog_item_id_fkey;
ALTER TABLE unit_daily_rates DROP COLUMN IF EXISTS catalog_item_id;
ALTER TABLE unit_daily_rates ADD CONSTRAINT unit_daily_rates_unique UNIQUE (unit_id, date);
DROP INDEX IF EXISTS idx_unit_daily_rates_range;
CREATE INDEX idx_unit_daily_rates_range ON unit_daily_rates(business_id, unit_id, date);

-- ── Cleanup kolom yang pindah semantik ───────────────────────────────────────
ALTER TABLE businesses DROP COLUMN IF EXISTS calendar_rate_item_id; -- pindah ke business_units.rate_item_id (per-unit)
ALTER TABLE catalog_items DROP COLUMN IF EXISTS is_bookable_unit;   -- konsep dihapus — catalog item bukan unit
ALTER TABLE catalog_items DROP COLUMN IF EXISTS ical_import_url;    -- pindah ke business_units.ical_import_url (0 baris terisi)

-- ============================================================
-- ROLLBACK (manual):
-- ALTER TABLE catalog_items ADD COLUMN ical_import_url TEXT;
-- ALTER TABLE catalog_items ADD COLUMN is_bookable_unit BOOLEAN NOT NULL DEFAULT TRUE;
-- ALTER TABLE businesses ADD COLUMN calendar_rate_item_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL;
-- (bookings.unit_id / unit_daily_rates.unit_id: tidak ada jalan mundur otomatis
--  ke catalog_item_id — restore dari backup bila benar-benar perlu revert.)
-- DROP TABLE IF EXISTS business_units CASCADE;
-- ============================================================
