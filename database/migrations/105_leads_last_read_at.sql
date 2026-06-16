-- ============================================================================
-- 105_leads_last_read_at.sql
-- Read-state notifikasi inbox Leads (shared per-tim).
--
-- Notifikasi yang dimaksud = PESAN MASUK (inbound) yang belum dilihat, BUKAN
-- "menghitung leads" / status='new'. Sebuah lead "unread" jika punya pesan
-- inbound yang lebih baru dari last_read_at. Saat manager membuka thread,
-- last_read_at = now() → badge (bell + business switcher) hilang utk seluruh tim.
--
-- Kenapa pakai last_inbound_at terpisah, bukan last_message_at:
-- last_message_at ikut ter-update saat tim mengirim balasan (outbound), jadi
-- tidak bisa dipakai sbg sinyal "ada pesan customer baru". last_inbound_at hanya
-- bergerak saat ada pesan masuk dari customer.
-- ============================================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;

COMMENT ON COLUMN leads.last_read_at IS
  'Waktu terakhir thread lead dibuka tim. NULL = belum pernah dibuka.';
COMMENT ON COLUMN leads.last_inbound_at IS
  'Waktu pesan inbound (customer) terakhir. Dipakai utk hitung unread: lead unread jika last_read_at IS NULL atau < last_inbound_at.';

-- Backfill last_inbound_at dari pesan inbound yang sudah ada.
UPDATE leads l
SET last_inbound_at = sub.max_inbound
FROM (
  SELECT lead_id, MAX(created_at) AS max_inbound
  FROM lead_messages
  WHERE direction = 'inbound'
  GROUP BY lead_id
) sub
WHERE l.id = sub.lead_id
  AND l.last_inbound_at IS NULL;

-- Trigger: jaga last_inbound_at tetap akurat tiap ada pesan inbound baru,
-- apa pun jalur insertnya (webhook, generic inbound, manual SQL).
CREATE OR REPLACE FUNCTION touch_lead_last_inbound()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'inbound' THEN
    UPDATE leads
    SET last_inbound_at = GREATEST(COALESCE(last_inbound_at, NEW.created_at), NEW.created_at)
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_lead_last_inbound ON lead_messages;
CREATE TRIGGER trg_touch_lead_last_inbound
  AFTER INSERT ON lead_messages
  FOR EACH ROW
  EXECUTE FUNCTION touch_lead_last_inbound();

-- Index parsial untuk hitung unread cepat per bisnis.
CREATE INDEX IF NOT EXISTS idx_leads_unread
  ON leads(business_id)
  WHERE deleted_at IS NULL
    AND last_inbound_at IS NOT NULL
    AND (last_read_at IS NULL OR last_read_at < last_inbound_at);
