-- Migration 127: Google Sheets Playground (integrasi per-USER, bukan per-bisnis)
--
-- Sheets diposisikan sebagai PLAYGROUND/scratchpad, BUKAN sumber kebenaran.
-- Tidak ada satu baris pun yang masuk ledger tanpa approval eksplisit user di
-- preview import. Jalur tulis transaksi tetap /api/transactions/bulk yang sudah
-- ada (manager-only + period lock + verifikasi kepemilikan akun).
--
-- Scope OAuth yang dipakai HANYA non-sensitive:
--   openid, email, https://www.googleapis.com/auth/drive.file
-- File dipilih user lewat Google Picker (grant per-file). AXION tidak pernah
-- bisa me-listing Drive user — itu konsekuensi yang memang diinginkan, dan
-- yang membuat app ini lolos tanpa security assessment (CASA).
--
-- Pola tabel mengikuti telegram_connections (migrasi 038): integrasi per-user
-- dengan UNIQUE(user_id) + RLS auth.uid() = user_id.

-- ============================================================
-- 1. Koneksi Google per-user
-- ============================================================
CREATE TABLE IF NOT EXISTS google_sheets_connections (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identitas akun Google — aman ditampilkan di UI
  google_account_email TEXT NOT NULL,
  google_sub           TEXT NOT NULL,  -- klaim `sub` id_token; deteksi ganti akun

  -- RAHASIA. Terenkripsi AES-256-GCM lewat src/lib/utils/tokenCrypto.ts
  -- (format iv:tag:cipher). JANGAN PERNAH di-SELECT dari browser —
  -- lihat blok REVOKE/GRANT kolom di bawah.
  access_token         TEXT,
  refresh_token        TEXT NOT NULL,
  token_expires_at     TIMESTAMPTZ,

  scopes               TEXT[] NOT NULL DEFAULT '{}',
  is_active            BOOLEAN NOT NULL DEFAULT true,
  -- Diisi saat refresh gagal dengan invalid_grant (user mencabut akses di
  -- myaccount.google.com/permissions, atau refresh token kedaluwarsa).
  -- UI menampilkan tombol "Hubungkan ulang" saat kolom ini terisi.
  last_error           TEXT,
  revoked_at           TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_google_sheets_connections_user
  ON google_sheets_connections(user_id);

DROP TRIGGER IF EXISTS update_google_sheets_connections_updated_at
  ON google_sheets_connections;
CREATE TRIGGER update_google_sheets_connections_updated_at
  BEFORE UPDATE ON google_sheets_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE google_sheets_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_sheets_connections_self" ON google_sheets_connections;
CREATE POLICY "google_sheets_connections_self"
  ON google_sheets_connections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Defense-in-depth: RLS sudah membatasi ke baris sendiri, tapi kolom token
-- tidak boleh terbaca browser SAMA SEKALI. Column-level grant menutup itu —
-- kalau ada kode yang tidak sengaja `select('*')` dari client, PostgREST akan
-- error keras ("permission denied for column refresh_token") alih-alih diam-diam
-- membocorkan token. Semua akses token dilakukan server-side lewat
-- createAdminClient() di src/lib/google/connection.ts.
REVOKE ALL ON google_sheets_connections FROM anon, authenticated;
GRANT SELECT (id, user_id, google_account_email, is_active, last_error,
              revoked_at, created_at, updated_at)
  ON google_sheets_connections TO authenticated;
GRANT DELETE ON google_sheets_connections TO authenticated;

-- ============================================================
-- 2. Spreadsheet yang pernah dibuka/dibuat user
--    Grant drive.file bersifat DURABLE per (user, OAuth client, file), jadi
--    spreadsheet_id yang disimpan tetap bisa dibaca di sesi berikutnya tanpa
--    perlu memilih ulang lewat Picker.
-- ============================================================
CREATE TABLE IF NOT EXISTS google_sheets_recent_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Konteks bisnis saat file dipakai; NULL = belum terikat bisnis manapun
  business_id     UUID REFERENCES businesses(id) ON DELETE CASCADE,

  spreadsheet_id  TEXT NOT NULL,
  title           TEXT NOT NULL,
  url             TEXT,
  last_sheet_name TEXT,
  -- 'picked'  = dipilih user lewat Google Picker
  -- 'created' = dibuat AXION lewat export laporan
  origin          TEXT NOT NULL DEFAULT 'picked'
                  CHECK (origin IN ('picked', 'created')),

  last_opened_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, spreadsheet_id)
);

CREATE INDEX IF NOT EXISTS idx_google_sheets_recent_user_opened
  ON google_sheets_recent_files(user_id, last_opened_at DESC);

DROP TRIGGER IF EXISTS update_google_sheets_recent_files_updated_at
  ON google_sheets_recent_files;
CREATE TRIGGER update_google_sheets_recent_files_updated_at
  BEFORE UPDATE ON google_sheets_recent_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE google_sheets_recent_files ENABLE ROW LEVEL SECURITY;

-- Baris milik sendiri, DAN business_id harus bisnis yang memang diikuti user
-- (mencegah user menempelkan catatan file ke business_id acak).
DROP POLICY IF EXISTS "google_sheets_recent_files_self" ON google_sheets_recent_files;
CREATE POLICY "google_sheets_recent_files_self"
  ON google_sheets_recent_files FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (business_id IS NULL OR business_id IN (SELECT get_my_business_ids()))
  );

-- ============================================================
-- 3. import_batches: catat ASAL data, JANGAN lebarkan import_mode
--    import_mode = cara resolve (smart|full) — ortogonal terhadap sumbernya.
--    Menambahkan 'sheets' ke enum itu justru menghapus sinyal smart/full.
-- ============================================================
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'file';
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS source_ref TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'import_batches_source_check'
  ) THEN
    ALTER TABLE import_batches
      ADD CONSTRAINT import_batches_source_check
      CHECK (source IN ('file', 'google_sheets', 'channel'));
  END IF;
END $$;

COMMENT ON COLUMN import_batches.source IS
  'file = upload Excel/CSV, google_sheets = tarik dari Google Sheets, channel = importer marketplace';
COMMENT ON COLUMN import_batches.source_ref IS
  'Identitas sumber: spreadsheetId untuk google_sheets, NULL untuk file';

COMMENT ON TABLE google_sheets_connections IS
  'Koneksi Google per-USER untuk playground Sheets. Token terenkripsi; hanya diakses server-side.';
COMMENT ON TABLE google_sheets_recent_files IS
  'Spreadsheet yang pernah dibuka/dibuat user. Hanya file di sini yang punya grant drive.file.';
