-- Migration 039: Reconciliation Sessions
-- Menyimpan sesi rekonsiliasi bank sehingga saldo bank yang user input,
-- periode, dan status kerjaan user tidak hilang saat refresh halaman.
--
-- Sebelumnya `useReconciliation` hanya menyimpan bankBalance, dateRange, dan
-- selectedIds di React state — semua hilang setiap kali halaman di-refresh.

CREATE TABLE IF NOT EXISTS reconciliation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Akun kas/bank yang di-reconcile (1100, 1200, atau sub-akunnya)
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  account_code TEXT,

  -- Periode rekonsiliasi
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Saldo menurut mutasi bank (user input manual)
  bank_statement_balance NUMERIC NOT NULL DEFAULT 0,

  -- Saldo buku saat sesi dimulai / disimpan (snapshot dari calculations)
  book_balance_snapshot NUMERIC,

  -- Selisih saldo (bank - book) saat sesi disimpan
  difference NUMERIC,

  -- Status sesi rekonsiliasi
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'discarded')),

  -- Catatan bebas (opsional): alasan selisih, temuan, dll
  notes TEXT,

  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),

  -- Pastikan tidak ada dua sesi 'in_progress' untuk kombinasi sama
  CONSTRAINT reconciliation_sessions_period_nonneg CHECK (period_end >= period_start)
);

-- Hanya boleh satu sesi 'in_progress' per business + account + period
-- (unique partial index supaya sesi completed/discarded tidak blokir sesi baru)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_recon_session_in_progress
  ON reconciliation_sessions (business_id, account_id, period_start, period_end)
  WHERE status = 'in_progress';

-- Index untuk query riwayat sesi per business
CREATE INDEX IF NOT EXISTS idx_recon_sessions_business_date
  ON reconciliation_sessions (business_id, period_end DESC);

-- Tabel pivot: transaksi mana saja yang ditandai "match" di dalam satu sesi
-- Memungkinkan user simpan progres parsial (pilih transaksi, close tab, lanjut besok)
CREATE TABLE IF NOT EXISTS reconciliation_session_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES reconciliation_sessions(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  matched_by UUID NOT NULL REFERENCES auth.users(id),

  UNIQUE (session_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_recon_matches_session
  ON reconciliation_session_matches (session_id);

-- Auto-update updated_at
CREATE TRIGGER update_reconciliation_sessions_updated_at
  BEFORE UPDATE ON reconciliation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE reconciliation_sessions IS 'Sesi rekonsiliasi bank: saldo bank user input, periode, status kerjaan';
COMMENT ON COLUMN reconciliation_sessions.bank_statement_balance IS 'Saldo yang user ketik dari mutasi bank — sebelumnya hilang saat refresh';
COMMENT ON COLUMN reconciliation_sessions.book_balance_snapshot IS 'Snapshot saldo buku saat sesi disimpan (opsional, untuk audit)';
COMMENT ON TABLE reconciliation_session_matches IS 'Pivot transaksi vs sesi — progres parsial user selama reconcile';

-- RLS
ALTER TABLE reconciliation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_session_matches ENABLE ROW LEVEL SECURITY;

-- === reconciliation_sessions ===
CREATE POLICY "Users can view reconciliation sessions of their businesses"
  ON reconciliation_sessions FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

CREATE POLICY "Managers can insert reconciliation sessions"
  ON reconciliation_sessions FOR INSERT
  WITH CHECK (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = reconciliation_sessions.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can update reconciliation sessions"
  ON reconciliation_sessions FOR UPDATE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = reconciliation_sessions.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

CREATE POLICY "Managers can delete reconciliation sessions"
  ON reconciliation_sessions FOR DELETE
  USING (
    business_id IN (SELECT get_my_business_ids())
    AND EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_id = auth.uid()
        AND business_id = reconciliation_sessions.business_id
        AND role IN ('business_manager', 'both', 'superadmin')
    )
  );

-- === reconciliation_session_matches ===
CREATE POLICY "Users can view match rows of their business sessions"
  ON reconciliation_session_matches FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM reconciliation_sessions
      WHERE business_id IN (SELECT get_my_business_ids())
    )
  );

CREATE POLICY "Managers can insert match rows"
  ON reconciliation_session_matches FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT rs.id FROM reconciliation_sessions rs
      WHERE rs.business_id IN (SELECT get_my_business_ids())
        AND EXISTS (
          SELECT 1 FROM user_business_roles
          WHERE user_id = auth.uid()
            AND business_id = rs.business_id
            AND role IN ('business_manager', 'both', 'superadmin')
        )
    )
  );

CREATE POLICY "Managers can delete match rows"
  ON reconciliation_session_matches FOR DELETE
  USING (
    session_id IN (
      SELECT rs.id FROM reconciliation_sessions rs
      WHERE rs.business_id IN (SELECT get_my_business_ids())
        AND EXISTS (
          SELECT 1 FROM user_business_roles
          WHERE user_id = auth.uid()
            AND business_id = rs.business_id
            AND role IN ('business_manager', 'both', 'superadmin')
        )
    )
  );
