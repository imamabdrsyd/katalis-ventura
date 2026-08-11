-- Migration 129: `restore_transaction` memulihkan kembali jejak pelunasan
-- (cermin dari migrasi 108/109). Temuan audit ACC-M4, sisi yang belum tertutup.
--
-- MASALAH
-- Migrasi 108 & 109 membuat `soft_delete_transaction` membersihkan jejak pelunasan
-- di tagihan asal saat entri pelunasan dihapus — benar. Tapi operasi itu tidak punya
-- pasangan: `restore_transaction` hanya mengosongkan `deleted_at`/`deleted_by` dan
-- TIDAK memasang kembali jejak tersebut.
--
-- Akibatnya alur yang sangat umum ini menghasilkan pembukuan yang tidak konsisten:
--   1. User hapus entri pelunasan  -> meta tagihan asal dibersihkan (108/109)
--   2. User klik "Urungkan" di toast (src/lib/transactionToast.tsx) atau restore
--      massal dari daftar transaksi terhapus
--   3. Entri pelunasan HIDUP kembali di buku besar (Dr Bank / Cr Piutang tetap
--      mempengaruhi Neraca & Arus Kas) ...
--   4. ... tapi tagihan asal tetap tampak BELUM LUNAS: masih muncul di AR/AP aging,
--      dan yang paling berbahaya — masih bisa dilunasi SEKALI LAGI, sehingga piutang
--      ter-kredit dua kali dan saldonya jadi negatif.
--
-- PERBAIKAN
-- `restore_transaction` kini menerapkan ULANG efek pelunasan ke tagihan asal, persis
-- kebalikan dari yang dilakukan `soft_delete_transaction`:
--   * sisa tagihan dihitung ulang dengan aturan yang sama seperti `settle_transaction`
--   * kalau nominal yang dipulihkan menutup seluruh sisa -> full settlement
--     (`settled_by_transaction_id` + `remaining_amount = 0`)
--   * kalau tidak -> partial (`partial_settlements` ditambah id-nya + sisa baru)
--
-- Aturan "sisa tagihan" diekstrak ke helper `calc_settlement_outstanding()` supaya
-- ada satu definisi tertulis dan tidak menyebar sebagai salinan ketiga.
--
-- CATATAN: `settle_transaction` (migr 110) masih memakai salinan in-line dari aturan
-- yang sama dan SENGAJA tidak disentuh di sini — fungsi itu ~340 baris dan migrasi 110
-- lahir justru karena drift saat menulis ulangnya. Menyatukan keduanya adalah pekerjaan
-- tersendiri; kalau aturan sisa tagihan berubah, UBAH KEDUANYA.

-- ==============================================================================
-- 1. HELPER: sisa tagihan (outstanding) sebuah open item
-- ==============================================================================
-- Mirror dari blok perhitungan `v_outstanding` di settle_transaction (migr 110).
-- Tidak di-GRANT ke `authenticated`: hanya dipanggil dari dalam fungsi SECURITY
-- DEFINER lain, jadi tak perlu menambah permukaan akses baru.

CREATE OR REPLACE FUNCTION calc_settlement_outstanding(p_transaction_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original transactions%ROWTYPE;
  v_outstanding NUMERIC;
  v_partial_paid NUMERIC;
BEGIN
  SELECT * INTO v_original FROM transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Sisa yang sudah tercatat eksplisit selalu menang (sama seperti client
  -- getOutstandingAmount() yang mendahulukan meta.remaining_amount).
  IF v_original.meta ? 'remaining_amount' THEN
    RETURN (v_original.meta->>'remaining_amount')::NUMERIC;
  END IF;

  IF v_original.is_multi_line THEN
    -- Multi-line: net debit baris akun PIUTANG saja (BUKAN header amount/gross) — Issue #26.
    SELECT COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)
      INTO v_outstanding
    FROM journal_lines jl
    JOIN accounts a ON a.id = jl.account_id
    WHERE jl.transaction_id = v_original.id
      AND a.account_type = 'ASSET'
      AND (
        a.is_trade_receivable IS TRUE
        OR a.default_category IN ('FIN', 'EARN')
        OR a.account_name ~* 'piutang usaha|piutang dagang|piutang pelanggan|trade receivable|account receivable|accounts receivable|talangan|advance'
      );
    -- Fallback ke header amount kalau tak ada baris piutang terdeteksi (mirror client).
    IF v_outstanding IS NULL OR v_outstanding <= 0 THEN
      v_outstanding := v_original.amount;
    END IF;
  ELSE
    -- Single double-entry / legacy: baris piutang = seluruh header amount.
    v_outstanding := v_original.amount;
  END IF;

  -- Kurangi pelunasan sebagian yang masih hidup.
  IF v_original.meta ? 'partial_settlements'
     AND jsonb_array_length(v_original.meta->'partial_settlements') > 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_partial_paid
    FROM transactions
    WHERE id IN (
      SELECT value::text::uuid
      FROM jsonb_array_elements_text(v_original.meta->'partial_settlements')
    )
    AND deleted_at IS NULL;

    v_outstanding := v_outstanding - v_partial_paid;
  END IF;

  RETURN v_outstanding;
END;
$$;

COMMENT ON FUNCTION calc_settlement_outstanding(UUID) IS
  'Sisa tagihan (outstanding) sebuah open item, mengikuti aturan yang sama dengan '
  'settle_transaction & client getOutstandingAmount(). Dipakai restore_transaction '
  '(migr 129) untuk menerapkan ulang pelunasan yang dipulihkan.';

-- ==============================================================================
-- 2. UPDATE RPC `restore_transaction`
-- ==============================================================================
-- Auth/role check dipertahankan apa adanya dari migrasi 090.

CREATE OR REPLACE FUNCTION restore_transaction(transaction_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_id UUID;
  v_restored_amount NUMERIC;
  v_outstanding NUMERIC;
  v_new_remaining NUMERIC;
  v_existing_partials JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM transactions t
    WHERE t.id = transaction_id
      AND t.deleted_at IS NOT NULL
      AND is_business_manager(t.business_id)
  ) THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan atau tidak berhak memulihkan'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Pulihkan transaksi
  UPDATE transactions
  SET deleted_at = NULL,
      deleted_by = NULL
  WHERE id = transaction_id
    AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or not deleted: %', transaction_id;
  END IF;

  -- 2. Kalau yang dipulihkan adalah entri PELUNASAN, pasang kembali jejaknya
  --    di tagihan asal (kebalikan dari soft_delete_transaction migr 108/109).
  SELECT
    (meta->>'settlement_of_transaction_id')::uuid,
    amount
  INTO v_original_id, v_restored_amount
  FROM transactions
  WHERE id = transaction_id
    AND meta ? 'settlement_of_transaction_id';

  IF v_original_id IS NULL THEN
    RETURN;
  END IF;

  -- Tagihan asal harus masih hidup; kalau ikut terhapus, tidak ada yang perlu ditandai.
  PERFORM 1 FROM transactions
    WHERE id = v_original_id AND deleted_at IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_outstanding := calc_settlement_outstanding(v_original_id);
  IF v_outstanding IS NULL THEN
    RETURN;
  END IF;

  v_new_remaining := v_outstanding - v_restored_amount;

  IF v_new_remaining <= 0.01 THEN
    -- Menutup seluruh sisa -> full settlement.
    UPDATE transactions
    SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
      'settled_by_transaction_id', transaction_id::text,
      'remaining_amount', 0
    )
    WHERE id = v_original_id;
  ELSE
    -- Masih menyisakan tagihan -> partial settlement.
    SELECT COALESCE(meta->'partial_settlements', '[]'::jsonb)
      INTO v_existing_partials
    FROM transactions WHERE id = v_original_id;

    -- Jangan menduplikasi id kalau (karena alasan apa pun) sudah tercatat.
    IF NOT (v_existing_partials @> to_jsonb(ARRAY[transaction_id::text])) THEN
      v_existing_partials := v_existing_partials || to_jsonb(transaction_id::text);
    END IF;

    UPDATE transactions
    SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
      'partial_settlements', v_existing_partials,
      'remaining_amount', v_new_remaining
    )
    WHERE id = v_original_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION restore_transaction(UUID) TO authenticated;

COMMENT ON FUNCTION restore_transaction IS
  'Restore soft-deleted transaksi. Membutuhkan manager/superadmin di bisnis terkait. '
  'Bila yang dipulihkan adalah entri pelunasan, jejak lunas di tagihan asal dipasang '
  'kembali (migr 129, audit ACC-M4).';

SELECT 'Migration 129 complete - restore_transaction re-applies settlement meta' as status;
