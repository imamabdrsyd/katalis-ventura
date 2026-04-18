-- Tambah kolom default_transaction_status di telegram_connections
-- User bisa pilih default status saat input via Telegram bot: 'draft' atau 'posted'

ALTER TABLE telegram_connections
  ADD COLUMN IF NOT EXISTS default_transaction_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (default_transaction_status IN ('draft', 'posted'));

COMMENT ON COLUMN telegram_connections.default_transaction_status IS
  'Default status transaksi saat input via Telegram bot: draft (default) atau posted (langsung final)';
