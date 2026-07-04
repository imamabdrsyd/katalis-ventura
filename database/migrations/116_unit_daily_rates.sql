-- Migration 116: Kalender harga per tanggal (Airbnb-style pricing calendar)
--
-- (1) businesses.calendar_rate_item_id
--     Item katalog yang DITUNJUK sebagai sumber harga dasar kalender booking
--     (mis. "Weekday Daily Rent"). Harga dasar = default_price item tsb; harga
--     per tanggal = override di unit_daily_rates > default. Satu per bisnis —
--     konsisten dengan realita 1 unit fisik; bisnis multi-unit menyusul.
--
-- (2) unit_daily_rates — layer override harga per (item, tanggal).
--     Baris hanya dibuat untuk tanggal yang harganya BEDA dari default
--     (hapus baris = kembali ke default). Dipakai: tampilan kalender (mode
--     Harga), auto-total booking (Σ harga per malam), quote AI concierge,
--     dan kalender harga di halaman publik omni-channel.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS calendar_rate_item_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN businesses.calendar_rate_item_id IS
  'Item katalog sumber harga dasar kalender booking (akomodasi). NULL = belum dipilih.';

CREATE TABLE IF NOT EXISTS unit_daily_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unit_daily_rates_unique UNIQUE (catalog_item_id, date)
);

COMMENT ON TABLE unit_daily_rates IS
  'Override harga per malam per tanggal (kalender harga akomodasi). Tanpa baris = pakai default_price item.';

CREATE INDEX idx_unit_daily_rates_range ON unit_daily_rates(business_id, catalog_item_id, date);

-- Triggers standar
CREATE TRIGGER update_unit_daily_rates_updated_at
  BEFORE UPDATE ON unit_daily_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_unit_daily_rates_updated_by
  BEFORE UPDATE ON unit_daily_rates
  FOR EACH ROW EXECUTE FUNCTION set_updated_by();

-- RLS: member read, manager write (pola catalog_items/bookings)
ALTER TABLE unit_daily_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view daily rates of their businesses"
  ON unit_daily_rates FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

CREATE POLICY "Managers can insert daily rates"
  ON unit_daily_rates FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = unit_daily_rates.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can update daily rates"
  ON unit_daily_rates FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = unit_daily_rates.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can delete daily rates"
  ON unit_daily_rates FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = unit_daily_rates.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- ============================================================
-- ROLLBACK (manual):
-- DROP TABLE IF EXISTS unit_daily_rates;
-- ALTER TABLE businesses DROP COLUMN IF EXISTS calendar_rate_item_id;
-- ============================================================
