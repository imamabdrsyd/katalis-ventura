-- Migration 019: E-commerce integrations (Shopee phase 1)
-- Tabel koneksi per bisnis ke platform e-commerce + sync logs

-- 1. Tabel koneksi e-commerce
CREATE TABLE business_ecommerce_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('shopee', 'tokopedia', 'tiktok')),

  -- Shopee-specific identifiers
  shop_id BIGINT,
  shop_name TEXT,
  shop_logo TEXT,

  -- Token (disimpan as-is; enkripsi via Supabase vault bisa ditambahkan nanti)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Sync state
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  sync_cursor TEXT, -- timestamp terakhir order yang di-sync (unix timestamp as text)

  -- Extra metadata per platform
  meta JSONB NOT NULL DEFAULT '{}',

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Satu koneksi per platform per bisnis
  UNIQUE(business_id, platform)
);

-- 2. Log setiap sesi sync
CREATE TABLE ecommerce_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES business_ecommerce_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('manual', 'scheduled', 'webhook')),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  orders_fetched INT NOT NULL DEFAULT 0,
  transactions_created INT NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 3. Trigger updated_at
CREATE TRIGGER update_ecommerce_connections_updated_at
  BEFORE UPDATE ON business_ecommerce_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Index untuk query umum
CREATE INDEX idx_ecommerce_connections_business_id ON business_ecommerce_connections(business_id);
CREATE INDEX idx_ecommerce_sync_logs_connection_id ON ecommerce_sync_logs(connection_id);
CREATE INDEX idx_ecommerce_sync_logs_started_at ON ecommerce_sync_logs(started_at DESC);

-- 5. RLS
ALTER TABLE business_ecommerce_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_sync_logs ENABLE ROW LEVEL SECURITY;

-- Hanya business_manager / both yang bisa baca koneksi bisnis mereka
CREATE POLICY "ecommerce_connections_select" ON business_ecommerce_connections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.user_id = auth.uid()
        AND user_business_roles.business_id = business_ecommerce_connections.business_id
        AND user_business_roles.role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- Hanya business_manager / both yang bisa insert / update / delete
CREATE POLICY "ecommerce_connections_manage" ON business_ecommerce_connections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.user_id = auth.uid()
        AND user_business_roles.business_id = business_ecommerce_connections.business_id
        AND user_business_roles.role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- Sync logs: ikut permission koneksinya
CREATE POLICY "ecommerce_sync_logs_select" ON ecommerce_sync_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM business_ecommerce_connections c
      JOIN user_business_roles r ON r.business_id = c.business_id
      WHERE c.id = ecommerce_sync_logs.connection_id
        AND r.user_id = auth.uid()
        AND r.role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "ecommerce_sync_logs_insert" ON ecommerce_sync_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM business_ecommerce_connections c
      JOIN user_business_roles r ON r.business_id = c.business_id
      WHERE c.id = ecommerce_sync_logs.connection_id
        AND r.user_id = auth.uid()
        AND r.role IN ('business_manager', 'both', 'superadmin')
    )
  );
