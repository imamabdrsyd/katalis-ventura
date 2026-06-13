-- Migration 103: business_ai_knowledge
-- Pengetahuan bisnis level-bisnis yang dibaca AI saat membalas lead di SEMUA
-- channel (WhatsApp, Instagram, OTA, dll). Melengkapi
-- channel_integrations.ai_persona (yang per-channel & soal NADA bicara) — tabel
-- ini berisi FAKTA bisnis: jam buka, lokasi, kebijakan, FAQ, dll.
--
-- 1:1 dengan businesses (UNIQUE business_id). Sengaja DIPISAH dari tabel
-- businesses agar audit trigger businesses tidak ter-spam snapshot full-row JSON
-- tiap kali teks panjang ini diedit berulang. Preseden: channel_integrations.ai_persona.

CREATE TABLE IF NOT EXISTS business_ai_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_business_ai_knowledge_business_id ON business_ai_knowledge(business_id);

-- Triggers: updated_at, updated_by, audit trail
CREATE TRIGGER update_business_ai_knowledge_updated_at
  BEFORE UPDATE ON business_ai_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_business_ai_knowledge_updated_by
  BEFORE UPDATE ON business_ai_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

CREATE TRIGGER log_business_ai_knowledge_audit
  AFTER INSERT OR UPDATE OR DELETE ON business_ai_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

-- RLS
ALTER TABLE business_ai_knowledge ENABLE ROW LEVEL SECURITY;

-- SELECT: semua anggota bisnis (termasuk investor read-only) + service/admin
CREATE POLICY "Users can view ai knowledge of their businesses"
  ON business_ai_knowledge FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

-- INSERT: hanya manager/both/superadmin
CREATE POLICY "Managers can insert ai knowledge"
  ON business_ai_knowledge FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = business_ai_knowledge.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- UPDATE: hanya manager/both/superadmin
CREATE POLICY "Managers can update ai knowledge"
  ON business_ai_knowledge FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = business_ai_knowledge.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- Tanpa DELETE policy: cleanup via CASCADE saat bisnis dihapus. Row tidak pernah
-- dihapus langsung (upsert content = '' untuk mengosongkan).
