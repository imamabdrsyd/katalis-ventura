-- Migration 113: bookings (Calendar / nightly stays)
-- Sistem booking menginap untuk hub /calendar (bisnis jasa, sektor akomodasi /
-- short-term rental / villa). Tiap "unit/kamar" yang bisa dibooking adalah satu
-- catalog_items (item_type='service', unit='malam', default_price=harga/malam).
--
--   * Booking manual dibuat owner → saat ditandai LUNAS, app merakit transaksi
--     EARN multi-line (Dr Kas/Bank, Cr Pendapatan) dan menautkannya via
--     transaction_id (pola sama dengan POS useCashier.checkout).
--   * Booking is_external=true berasal dari impor iCal OTA (Airbnb/Booking.com) —
--     hanya sebagai blok ketersediaan, tak pernah di-EARN, tak boleh diedit user.
--
-- Kolom iCal:
--   catalog_items.ical_import_url  — URL feed .ics OTA untuk unit ini (impor blok)
--   businesses.ical_feed_token     — token feed .ics ekspor bisnis (dipasang di OTA)

-- ── Tabel bookings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  -- Unit/kamar yang dibooking. SET NULL agar hapus item katalog tak menghapus histori.
  catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL,
  -- Tamu. Nullable — nama tamu juga disimpan di guest_name sbagai fallback.
  contact_id UUID REFERENCES business_contacts(id) ON DELETE SET NULL,
  -- Transaksi EARN yang dibuat saat booking ditandai lunas (1:1).
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,

  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  -- Jumlah malam dihitung otomatis dari selisih tanggal.
  nights INTEGER GENERATED ALWAYS AS (check_out - check_in) STORED,

  price_per_night NUMERIC NOT NULL DEFAULT 0 CHECK (price_per_night >= 0),
  total_amount NUMERIC NOT NULL DEFAULT 0 CHECK (total_amount >= 0),

  guest_name TEXT,
  guest_count INTEGER CHECK (guest_count IS NULL OR guest_count > 0),

  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('tentative', 'confirmed', 'checked_in', 'completed', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid')),
  channel TEXT NOT NULL DEFAULT 'manual'
    CHECK (channel IN ('manual', 'airbnb', 'booking_com', 'other')),

  -- Blok ketersediaan hasil impor iCal OTA (bukan booking langsung kita).
  is_external BOOLEAN NOT NULL DEFAULT FALSE,
  -- UID VEVENT dari feed OTA untuk dedup impor idempoten.
  ical_uid TEXT,

  notes TEXT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT bookings_dates_valid CHECK (check_out > check_in),
  -- Satu booking = maksimal satu transaksi EARN (NULL diperbolehkan berulang).
  CONSTRAINT bookings_transaction_unique UNIQUE (transaction_id)
);

COMMENT ON TABLE bookings IS 'Booking menginap (nightly stays) hub /calendar; is_external=true = blok impor iCal OTA';
COMMENT ON COLUMN bookings.nights IS 'GENERATED: check_out - check_in (jumlah malam)';
COMMENT ON COLUMN bookings.transaction_id IS 'Transaksi EARN yang dibuat saat ditandai lunas (1:1)';
COMMENT ON COLUMN bookings.is_external IS 'true = blok ketersediaan hasil impor iCal OTA, read-only, tak di-EARN';

-- ── Index ────────────────────────────────────────────────────────────────────
CREATE INDEX idx_bookings_business ON bookings(business_id) WHERE deleted_at IS NULL;
-- Query rentang bulan + cek overlap per unit.
CREATE INDEX idx_bookings_range
  ON bookings(business_id, catalog_item_id, check_in, check_out)
  WHERE deleted_at IS NULL;
-- Dedup impor iCal: satu VEVENT (per unit) hanya jadi satu baris.
CREATE UNIQUE INDEX idx_bookings_unique_ical
  ON bookings(business_id, catalog_item_id, ical_uid)
  WHERE ical_uid IS NOT NULL AND deleted_at IS NULL;

-- ── Triggers: updated_at, updated_by, audit trail ─────────────────────────────
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_bookings_updated_by
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_by();

CREATE TRIGGER log_bookings_audit
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- SELECT: semua anggota bisnis (termasuk investor read-only)
CREATE POLICY "Users can view bookings of their businesses"
  ON bookings FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

-- INSERT/UPDATE/DELETE: hanya manager/both/superadmin
CREATE POLICY "Managers can insert bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = bookings.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can update bookings"
  ON bookings FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = bookings.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can delete bookings"
  ON bookings FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = bookings.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- ── Kolom iCal sync ────────────────────────────────────────────────────────────
-- Per unit: URL feed .ics OTA untuk impor blok ketersediaan.
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS ical_import_url TEXT;
COMMENT ON COLUMN catalog_items.ical_import_url IS 'URL feed .ics OTA (Airbnb/Booking.com) untuk impor blok ketersediaan unit ini';

-- Per bisnis: token feed .ics ekspor (dipasang user di OTA sebagai "import calendar").
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS ical_feed_token UUID NOT NULL DEFAULT gen_random_uuid();
COMMENT ON COLUMN businesses.ical_feed_token IS 'Token rahasia untuk URL feed .ics ekspor booking bisnis ini';
