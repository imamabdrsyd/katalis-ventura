-- Migration 101: Leads Hub
-- Fondasi database untuk AXION Leads Hub: pesan masuk dari WhatsApp & OTA
-- (Airbnb/Booking.com via Zapier/Make) tersimpan sebagai leads + riwayat
-- percakapan, dengan balasan AI (auto utk WhatsApp, draft utk OTA).
--
-- 3 tabel:
--   1. channel_integrations — config per bisnis per channel (kredensial,
--      toggle AI, persona). UNIQUE(business_id, channel).
--   2. leads — satu baris per kontak unik per channel per bisnis.
--   3. lead_messages — riwayat pesan inbound/outbound per lead (immutable).
--
-- Konvensi mengikuti migration 099 (catalog_items): UUID PK, TIMESTAMPTZ,
-- soft-delete via deleted_at, trigger updated_at/updated_by/audit,
-- RLS pakai get_my_business_ids() + role check manager.
-- Webhook menulis via service role (createAdminClient) — bypass RLS,
-- jadi tidak perlu policy anon.

-- ============================================================================
-- 1. channel_integrations
-- ============================================================================

CREATE TABLE IF NOT EXISTS channel_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN (
    'whatsapp', 'airbnb', 'booking_com', 'instagram',
    'shopee', 'tokopedia', 'tiktok_shop'
  )),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- ID akun di platform eksternal (mis. WhatsApp phone_number_id).
  -- Dipakai webhook untuk lookup bisnis dari payload masuk.
  external_account_id TEXT,
  -- Config channel-specific (token per bisnis, dsb) — fleksibel ke depan.
  config JSONB,
  -- AI auto-reply: ai_mode 'auto' = langsung kirim (WhatsApp),
  -- 'draft' = simpan sebagai draft utk manual approve (OTA).
  ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ai_mode TEXT NOT NULL DEFAULT 'draft' CHECK (ai_mode IN ('auto', 'draft')),
  -- Instruksi tone/persona tambahan untuk system prompt AI.
  ai_persona TEXT,
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_channel_integrations_business_id
  ON channel_integrations(business_id) WHERE deleted_at IS NULL;

-- Lookup webhook: cari bisnis dari external_account_id (mis. phone_number_id)
CREATE INDEX idx_channel_integrations_external_account
  ON channel_integrations(channel, external_account_id)
  WHERE deleted_at IS NULL AND external_account_id IS NOT NULL;

-- Satu integrasi per channel per bisnis (yang belum dihapus)
CREATE UNIQUE INDEX idx_channel_integrations_unique_channel
  ON channel_integrations(business_id, channel)
  WHERE deleted_at IS NULL;

CREATE TRIGGER update_channel_integrations_updated_at
  BEFORE UPDATE ON channel_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_channel_integrations_updated_by
  BEFORE UPDATE ON channel_integrations
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

CREATE TRIGGER log_channel_integrations_audit
  AFTER INSERT OR UPDATE OR DELETE ON channel_integrations
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

-- ============================================================================
-- 2. leads
-- ============================================================================

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN (
    'whatsapp', 'airbnb', 'booking_com', 'instagram',
    'shopee', 'tokopedia', 'tiktok_shop'
  )),
  -- Identitas kontak di platform eksternal: no WA (wa_id) / thread id OTA.
  external_id TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'contacted', 'qualified', 'converted', 'lost'
  )),
  last_message_at TIMESTAMPTZ,
  -- User yang menangani lead ini (opsional)
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  meta JSONB,
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_leads_business_id
  ON leads(business_id) WHERE deleted_at IS NULL;

-- Inbox: urutkan per aktivitas terbaru
CREATE INDEX idx_leads_last_message
  ON leads(business_id, last_message_at DESC) WHERE deleted_at IS NULL;

-- Upsert lookup: satu lead per kontak per channel per bisnis
CREATE UNIQUE INDEX idx_leads_unique_external
  ON leads(business_id, channel, external_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_leads_updated_by
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

CREATE TRIGGER log_leads_audit
  AFTER INSERT OR UPDATE OR DELETE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

-- ============================================================================
-- 3. lead_messages (immutable — tanpa updated_at/soft-delete, cascade via lead)
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender TEXT NOT NULL CHECK (sender IN ('customer', 'ai', 'human')),
  content TEXT NOT NULL,
  -- ID pesan di platform eksternal (mis. wamid WhatsApp) — untuk dedup webhook retry.
  external_message_id TEXT,
  -- meta.is_draft=true utk balasan AI mode draft (belum dikirim, tunggu approve).
  meta JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_messages_business_id ON lead_messages(business_id);

-- Riwayat percakapan per lead, urut kronologis
CREATE INDEX idx_lead_messages_lead_created
  ON lead_messages(lead_id, created_at);

-- Dedup webhook retry: cek apakah pesan eksternal sudah tersimpan
CREATE INDEX idx_lead_messages_external_id
  ON lead_messages(business_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE TRIGGER log_lead_messages_audit
  AFTER INSERT OR UPDATE OR DELETE ON lead_messages
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE channel_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_messages ENABLE ROW LEVEL SECURITY;

-- ── channel_integrations ──

-- SELECT: semua anggota bisnis (termasuk investor read-only)
CREATE POLICY "Users can view channel integrations of their businesses"
  ON channel_integrations FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

-- INSERT: hanya manager/both/superadmin
CREATE POLICY "Managers can insert channel integrations"
  ON channel_integrations FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = channel_integrations.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- UPDATE: hanya manager/both/superadmin
CREATE POLICY "Managers can update channel integrations"
  ON channel_integrations FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = channel_integrations.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- DELETE: hanya manager/both/superadmin
CREATE POLICY "Managers can delete channel integrations"
  ON channel_integrations FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = channel_integrations.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- ── leads ──

CREATE POLICY "Users can view leads of their businesses"
  ON leads FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

CREATE POLICY "Managers can insert leads"
  ON leads FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = leads.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can update leads"
  ON leads FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = leads.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can delete leads"
  ON leads FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = leads.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- ── lead_messages ──

CREATE POLICY "Users can view lead messages of their businesses"
  ON lead_messages FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

-- INSERT: manager bisa balas manual dari inbox (sender='human').
-- Pesan webhook (customer/ai) masuk via service role, bypass RLS.
CREATE POLICY "Managers can insert lead messages"
  ON lead_messages FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = lead_messages.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- UPDATE: manager bisa edit draft AI sebelum approve (meta.is_draft)
CREATE POLICY "Managers can update lead messages"
  ON lead_messages FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = lead_messages.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- DELETE: manager bisa buang draft AI yang ditolak
CREATE POLICY "Managers can delete lead messages"
  ON lead_messages FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = lead_messages.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

SELECT 'Migration 101 complete - Leads Hub (channel_integrations, leads, lead_messages)' as status;
