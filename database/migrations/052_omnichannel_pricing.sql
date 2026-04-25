-- Migration: Tambah pricing untuk widget halaman publik bisnis Jasa
-- Bisnis manager bisa configure:
--   1) Apakah pricing ditampilkan di widget (show_pricing)
--   2) Harga default per service (default_price + price_unit free-text)
--   3) Override harga per range tanggal (business_pricing_rules)

-- ─── Kolom pricing default di omni-channel ──────────────────────────────────
ALTER TABLE business_omni_channels
  ADD COLUMN IF NOT EXISTS show_pricing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_price NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS price_unit TEXT;

-- price_unit: free-text (e.g. "malam", "kunjungan", "konten", "jam", dll)
-- default_price NULL artinya belum di-set

-- ─── Tabel override harga per range tanggal ─────────────────────────────────
CREATE TABLE IF NOT EXISTS business_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  omni_channel_id UUID NOT NULL REFERENCES business_omni_channels(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  price NUMERIC(15, 2) NOT NULL CHECK (price >= 0),
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pricing_rules_date_range_valid CHECK (date_from <= date_to)
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_omni_channel
  ON business_pricing_rules (omni_channel_id);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_dates
  ON business_pricing_rules (omni_channel_id, date_from, date_to);

-- ─── Trigger updated_at ─────────────────────────────────────────────────────
CREATE TRIGGER update_pricing_rules_updated_at
  BEFORE UPDATE ON business_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE business_pricing_rules ENABLE ROW LEVEL SECURITY;

-- Public read: jika omni-channel parent-nya is_published, siapa pun bisa baca
CREATE POLICY "pricing_rules_public_read" ON business_pricing_rules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_omni_channels oc
      WHERE oc.id = business_pricing_rules.omni_channel_id
        AND oc.is_published = true
    )
  );

-- Manager full access pada bisnis miliknya
CREATE POLICY "pricing_rules_manager_all" ON business_pricing_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM business_omni_channels oc
      JOIN user_business_roles ubr ON ubr.business_id = oc.business_id
      WHERE oc.id = business_pricing_rules.omni_channel_id
        AND ubr.user_id = auth.uid()
        AND ubr.role IN ('business_manager', 'both')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND default_role = 'superadmin'
    )
  );
