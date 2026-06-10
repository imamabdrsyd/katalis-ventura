-- Migration 099: catalog_items
-- Katalog produk/jasa terpusat per bisnis. Dipakai saat entry transaksi EARN
-- (picker di multi-line form & quick entry) untuk auto-isi amount, deskripsi,
-- dan akun pendapatan. Harga saja (belum ada stock tracking).
--
-- Catatan: kolom `sku` disiapkan untuk fase berikutnya (auto-match SKU dari
-- import TikTok/Tokopedia/dll) — belum dipakai sekarang.

CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL DEFAULT 'product' CHECK (item_type IN ('product', 'service')),
  default_price NUMERIC NOT NULL DEFAULT 0 CHECK (default_price >= 0),
  unit TEXT,
  -- Akun pendapatan default; saat dipilih di picker, journal line credit ke sini.
  -- ON DELETE SET NULL: hapus akun tidak menghapus item katalog.
  revenue_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  -- Disiapkan untuk fase matching import (belum dipakai).
  sku TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Index untuk query per bisnis + pencarian nama
CREATE INDEX idx_catalog_items_business_id ON catalog_items(business_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_catalog_items_name ON catalog_items(business_id, name);
CREATE INDEX idx_catalog_items_sku ON catalog_items(business_id, sku) WHERE sku IS NOT NULL;

-- Unique: nama item unik per bisnis (case-insensitive, hanya yang belum dihapus)
CREATE UNIQUE INDEX idx_catalog_items_unique_name
  ON catalog_items(business_id, LOWER(name))
  WHERE deleted_at IS NULL;

-- Triggers: updated_at, updated_by, audit trail
CREATE TRIGGER update_catalog_items_updated_at
  BEFORE UPDATE ON catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_catalog_items_updated_by
  BEFORE UPDATE ON catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

CREATE TRIGGER log_catalog_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

-- RLS
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

-- SELECT: semua anggota bisnis (termasuk investor read-only)
CREATE POLICY "Users can view catalog items of their businesses"
  ON catalog_items FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

-- INSERT: hanya manager/both/superadmin
CREATE POLICY "Managers can insert catalog items"
  ON catalog_items FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = catalog_items.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- UPDATE: hanya manager/both/superadmin
CREATE POLICY "Managers can update catalog items"
  ON catalog_items FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = catalog_items.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- DELETE: hanya manager/both/superadmin (soft-delete via deleted_at di app,
-- tapi hard-delete diizinkan untuk item yang belum pernah dipakai)
CREATE POLICY "Managers can delete catalog items"
  ON catalog_items FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = catalog_items.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );
