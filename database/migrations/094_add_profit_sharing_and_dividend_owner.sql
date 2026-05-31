-- Migration 094: Profit-sharing ratio, dividend→owner mapping, dan link pemilik ke kontak
-- Konteks: Statement of Changes in Equity (SCE) + rekonsiliasi dividen.
--   - profit_share_pct: hak atas laba (%) per pemilik, lepas dari % modal disetor.
--     Contoh Hillside Studio: modal 98.26%/1.74% tapi hak laba 50:50.
--     NULL = fallback ke % modal (cap table dari calculateCapTable).
--   - owner_stock_account_id: akun is_dividend menunjuk akun stock pemiliknya,
--     supaya dividen aktual bisa di-rekonsiliasi dengan hak dividen per pemilik.
--   - contact_id: akun is_stock di-link ke business_contacts (pemilik = kontak
--     tipe investor/partner) untuk integrasi data nama/HP/email.
-- Pola constraint ikut migration 075 (is_stock_only_equity).

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS profit_share_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS owner_stock_account_id UUID
    REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id UUID
    REFERENCES business_contacts(id) ON DELETE SET NULL;

-- Guardrails: kolom hanya valid untuk tipe akun yang tepat.
ALTER TABLE accounts
  ADD CONSTRAINT profit_share_pct_only_stock
  CHECK (profit_share_pct IS NULL OR is_stock = TRUE);

ALTER TABLE accounts
  ADD CONSTRAINT profit_share_pct_range
  CHECK (profit_share_pct IS NULL OR (profit_share_pct >= 0 AND profit_share_pct <= 100));

ALTER TABLE accounts
  ADD CONSTRAINT owner_link_only_dividend
  CHECK (owner_stock_account_id IS NULL OR is_dividend = TRUE);

ALTER TABLE accounts
  ADD CONSTRAINT contact_link_only_stock
  CHECK (contact_id IS NULL OR is_stock = TRUE);

-- Index untuk lookup rekonsiliasi (akun dividen per pemilik).
CREATE INDEX IF NOT EXISTS idx_accounts_owner_stock_account_id
  ON accounts(owner_stock_account_id)
  WHERE owner_stock_account_id IS NOT NULL;

COMMENT ON COLUMN accounts.profit_share_pct IS
  'Hak atas laba (%) pemilik untuk akun is_stock. NULL = pakai % modal disetor (cap table).';
COMMENT ON COLUMN accounts.owner_stock_account_id IS
  'Akun is_dividend menunjuk akun stock pemiliknya, untuk rekonsiliasi hak vs aktual dividen.';
COMMENT ON COLUMN accounts.contact_id IS
  'Akun is_stock di-link ke business_contacts (pemilik modal = kontak investor/partner). Integrasi data nama/HP/email.';

SELECT 'Migration 094 complete - profit_share_pct, owner_stock_account_id, contact_id added' as status;
