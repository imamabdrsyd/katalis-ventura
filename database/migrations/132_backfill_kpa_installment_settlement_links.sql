-- Migration 132: Tautkan cicilan KPA lama ke transaksi pencairannya
--
-- KONTEKS
-- Sebelum fitur pelunasan hutang ada (§14.8/§14.9), cicilan pinjaman dicatat
-- sebagai transaksi lepas: Dr Loans Payable + Dr Beban Ujrah / Cr <sumber dana>.
-- Buku besarnya BENAR — saldo 2100 Loans Payable sudah berkurang tiap cicilan —
-- tapi tidak ada satu pun jejak `meta` yang menghubungkannya ke transaksi
-- pencairan. Akibatnya di UI pinjaman itu tampil "belum dibayar sepeser pun"
-- (outstanding = header amount penuh) dan riwayat pembayarannya kosong.
--
-- Migrasi ini menulis jejak yang seharusnya ada, TANPA membuat transaksi baru
-- dan TANPA mengubah satu pun angka jurnal:
--   - pencairan  → meta.partial_settlements[] + meta.remaining_amount
--   - tiap cicilan → meta.settlement_of_transaction_id
--
-- CATATAN ANGKA
-- Yang dihitung sebagai "terbayar" adalah DEBIT ke akun pinjaman saja (porsi
-- pokok), bukan header amount cicilan yang juga memuat beban ujrah/bunga.
-- Konsisten dengan getPayableLineAmount() di sisi aplikasi: yang melunasi
-- hutang hanyalah baris pokoknya.
--
-- Idempoten: dilewati bila pencairan sudah punya partial_settlements.

DO $$
DECLARE
  v_account_id   UUID;
  v_business_id  UUID;
  v_principal_id UUID;
  v_original     NUMERIC;
  v_paid         NUMERIC;
  v_ids          UUID[];
  v_count        INT;
BEGIN
  -- Akun pinjaman yang dicicil (KPA CIMB — Hillside Studio).
  SELECT a.id, a.business_id INTO v_account_id, v_business_id
  FROM accounts a
  JOIN businesses b ON b.id = a.business_id
  WHERE b.business_name = 'Hillside Studio'
    AND a.account_code = '2100'
    AND a.account_type = 'LIABILITY'
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RAISE NOTICE 'Akun pinjaman tidak ditemukan — migrasi dilewati.';
    RETURN;
  END IF;

  -- Transaksi pencairan = satu-satunya yang MENGKREDIT akun pinjaman.
  SELECT t.id, t.amount INTO v_principal_id, v_original
  FROM transactions t
  JOIN journal_lines jl ON jl.transaction_id = t.id
  WHERE t.business_id = v_business_id
    AND t.deleted_at IS NULL
    AND jl.account_id = v_account_id
    AND jl.credit_amount > 0
  GROUP BY t.id, t.amount;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE NOTICE 'Pencairan tidak unik (% baris) — migrasi dilewati agar tidak salah taut.', v_count;
    RETURN;
  END IF;

  -- Sudah pernah ditautkan → jangan ulangi.
  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE id = v_principal_id AND meta ? 'partial_settlements'
  ) THEN
    RAISE NOTICE 'Pencairan sudah punya partial_settlements — migrasi dilewati.';
    RETURN;
  END IF;

  -- Cicilan = transaksi yang MENDEBIT akun pinjaman, urut kronologis.
  SELECT array_agg(s.id ORDER BY s.date, s.created_at), SUM(s.pokok)
  INTO v_ids, v_paid
  FROM (
    SELECT t.id, t.date, t.created_at, SUM(jl.debit_amount) AS pokok
    FROM transactions t
    JOIN journal_lines jl ON jl.transaction_id = t.id
    WHERE t.business_id = v_business_id
      AND t.deleted_at IS NULL
      AND jl.account_id = v_account_id
      AND jl.debit_amount > 0
    GROUP BY t.id, t.date, t.created_at
  ) s;

  IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
    RAISE NOTICE 'Tidak ada cicilan yang mendebit akun pinjaman — migrasi dilewati.';
    RETURN;
  END IF;

  -- Trigger dimatikan sementara: backfill ini tidak dilakukan oleh user mana pun,
  -- jadi `set_updated_by` (auth.uid() = NULL di konteks migrasi) tidak boleh
  -- menghapus jejak editor terakhir, dan 24 baris audit_log "meta berubah" hanya
  -- akan mengaburkan riwayat. Versi cache di-bump manual di bawah.
  ALTER TABLE transactions DISABLE TRIGGER USER;

  UPDATE transactions
  SET meta = COALESCE(meta, '{}'::jsonb)
             || jsonb_build_object('settlement_of_transaction_id', v_principal_id)
  WHERE id = ANY(v_ids)
    AND NOT (COALESCE(meta, '{}'::jsonb) ? 'settlement_of_transaction_id');

  UPDATE transactions
  SET meta = COALESCE(meta, '{}'::jsonb)
             || jsonb_build_object(
                  'partial_settlements', to_jsonb(v_ids),
                  'remaining_amount', v_original - v_paid
                )
  WHERE id = v_principal_id;

  ALTER TABLE transactions ENABLE TRIGGER USER;

  -- Invalidasi cache laporan secara eksplisit (menggantikan trigger yang dimatikan).
  INSERT INTO business_transaction_versions (business_id, transaction_version, updated_at)
  VALUES (v_business_id, 1, now())
  ON CONFLICT (business_id) DO UPDATE
    SET transaction_version = business_transaction_versions.transaction_version + 1,
        updated_at = now();

  UPDATE financial_summary_cache
    SET is_stale = TRUE
    WHERE business_id = v_business_id AND is_stale = FALSE;

  RAISE NOTICE 'Tertaut: % cicilan, pokok terbayar %, sisa %.',
    array_length(v_ids, 1), v_paid, v_original - v_paid;
END $$;
