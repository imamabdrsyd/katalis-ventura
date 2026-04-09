-- Migration 038: Telegram Bot Integration
-- Menambahkan tabel untuk koneksi Telegram bot dan link tokens

-- Table: telegram_connections
-- Menghubungkan Telegram chat_id ke user_id Katalis + bisnis aktif
CREATE TABLE IF NOT EXISTS telegram_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id      BIGINT NOT NULL,
  telegram_username     TEXT,
  telegram_first_name   TEXT,
  default_business_id   UUID REFERENCES businesses(id) ON DELETE SET NULL,
  pending_transaction   JSONB DEFAULT NULL,
  pending_expires_at    TIMESTAMPTZ DEFAULT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id),
  UNIQUE(telegram_chat_id)
);

-- Table: telegram_link_tokens
-- Token sementara (15 menit, single-use) untuk menghubungkan akun
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at     TIMESTAMPTZ DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_telegram_connections_user_id ON telegram_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_connections_chat_id ON telegram_connections(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_token ON telegram_link_tokens(token);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user_id ON telegram_link_tokens(user_id);

-- Trigger: auto update updated_at
CREATE TRIGGER update_telegram_connections_updated_at
  BEFORE UPDATE ON telegram_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE telegram_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;

-- telegram_connections: user hanya bisa akses baris miliknya sendiri
CREATE POLICY "telegram_connections_self"
  ON telegram_connections FOR ALL
  USING (auth.uid() = user_id);

-- telegram_link_tokens: user bisa SELECT dan INSERT baris miliknya
CREATE POLICY "telegram_link_tokens_select_self"
  ON telegram_link_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "telegram_link_tokens_insert_self"
  ON telegram_link_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Cleanup function: hapus token kadaluarsa atau sudah dipakai
CREATE OR REPLACE FUNCTION cleanup_expired_telegram_tokens()
RETURNS void AS $$
  DELETE FROM telegram_link_tokens
  WHERE expires_at < now() OR used_at IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER;
