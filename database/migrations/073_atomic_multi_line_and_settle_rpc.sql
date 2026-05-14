-- ============================================================
-- 073_atomic_multi_line_and_settle_rpc.sql
--
-- Tujuan: tutup dua celah ACID di transaksi multi-langkah yang
-- sebelumnya dilakukan via beberapa HTTP request terpisah:
--
--   1. createMultiLineTransaction (transactions.ts)
--      Sebelumnya: INSERT header → INSERT lines (2 DB transactions).
--      Kalau INSERT lines fail, client manual DELETE header sebagai
--      "rollback" — kalau DELETE fail, header jadi orphan + tidak
--      balance constraint terlanggar.
--
--   2. handleSettleReceivable / Partial / Dividend (useTransactions.ts)
--      Sebelumnya: createTransaction(settlement) → updateTransaction(original)
--      Kalau update fail, settlement jadi orphan (double-count AR).
--      Partial settlement punya race condition lost-update di
--      `meta.partial_settlements` (read-modify-write tanpa lock).
--
-- Solusi: bungkus seluruh langkah dalam stored procedure plpgsql
-- → single DB transaction = atomic. Settlement pakai SELECT ... FOR UPDATE
-- pada transaksi asli untuk mencegah lost update saat partial parallel.
-- ============================================================

-- ============================================================
-- 1. create_multi_line_transaction
-- ============================================================
--
-- Insert transaction header + N journal_lines dalam satu function.
-- Validasi balance di-handle oleh trigger DEFERRABLE existing
-- (037_add_journal_lines_balance_trigger.sql) yang fire saat commit.
-- ============================================================

CREATE OR REPLACE FUNCTION create_multi_line_transaction(
  p_business_id UUID,
  p_date DATE,
  p_category TEXT,
  p_name TEXT,
  p_description TEXT,
  p_notes TEXT,
  p_status TEXT,
  p_meta JSONB,
  p_lines JSONB
)
RETURNS TABLE (
  id UUID,
  business_id UUID,
  date DATE,
  category TEXT,
  name TEXT,
  description TEXT,
  amount NUMERIC,
  status TEXT,
  is_multi_line BOOLEAN,
  meta JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
  v_line_count INTEGER := 0;
  v_line JSONB;
  v_sort_order INTEGER := 0;
BEGIN
  -- Authorization: pastikan caller adalah manager/superadmin di business
  IF NOT EXISTS (
    SELECT 1 FROM user_business_roles
    WHERE user_id = auth.uid()
      AND business_id = p_business_id
      AND role IN ('business_manager', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Tidak berhak membuat transaksi di bisnis ini';
  END IF;

  -- Pre-validate balance & min lines (juga di-enforce oleh deferred trigger,
  -- tapi check di sini supaya error message lebih jelas).
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_total_debit := v_total_debit + COALESCE((v_line->>'debit_amount')::NUMERIC, 0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit_amount')::NUMERIC, 0);
    v_line_count := v_line_count + 1;
  END LOOP;

  IF v_line_count < 2 THEN
    RAISE EXCEPTION 'Multi-line journal harus memiliki minimal 2 baris (got %)', v_line_count;
  END IF;

  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Jurnal tidak seimbang: total debit (%) != total credit (%)',
      v_total_debit, v_total_credit;
  END IF;

  -- Insert transaction header
  INSERT INTO transactions (
    business_id, created_by, date, category, name, description,
    notes, amount, account, status, is_multi_line, is_double_entry, meta
  )
  VALUES (
    p_business_id,
    auth.uid(),
    p_date,
    p_category,
    p_name,
    p_description,
    NULLIF(p_notes, ''),
    v_total_debit,
    'Multi-line journal entry',
    COALESCE(NULLIF(p_status, ''), 'draft'),
    TRUE,
    FALSE,
    CASE WHEN p_meta IS NULL OR p_meta = '{}'::jsonb THEN NULL ELSE p_meta END
  )
  RETURNING transactions.id INTO v_transaction_id;

  -- Insert journal lines
  v_sort_order := 0;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO journal_lines (
      transaction_id,
      account_id,
      debit_amount,
      credit_amount,
      description,
      sort_order
    ) VALUES (
      v_transaction_id,
      (v_line->>'account_id')::UUID,
      COALESCE((v_line->>'debit_amount')::NUMERIC, 0),
      COALESCE((v_line->>'credit_amount')::NUMERIC, 0),
      NULLIF(v_line->>'description', ''),
      COALESCE((v_line->>'sort_order')::INTEGER, v_sort_order)
    );
    v_sort_order := v_sort_order + 1;
  END LOOP;

  -- Return the inserted header (deferred balance trigger akan fire di commit)
  RETURN QUERY
    SELECT
      t.id,
      t.business_id,
      t.date,
      t.category,
      t.name,
      t.description,
      t.amount,
      t.status,
      t.is_multi_line,
      t.meta,
      t.created_by,
      t.created_at
    FROM transactions t
    WHERE t.id = v_transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_multi_line_transaction(
  UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB
) TO authenticated;

COMMENT ON FUNCTION create_multi_line_transaction IS
  'Atomic insert header + journal_lines untuk multi-line journal entry. '
  'Menggantikan pola client-side INSERT-INSERT-rollback yang non-atomic.';


-- ============================================================
-- 2. settle_transaction
-- ============================================================
--
-- Satu RPC untuk handle 4 kasus settlement (full/partial × receivable/dividend).
-- Client tetap membangun settlement_data via builder TS — RPC hanya bertanggung
-- jawab atas atomicity (insert settlement + update meta) dan locking.
--
-- Param:
--   p_original_transaction_id : transaksi asli yang dilunasi
--   p_settlement_data         : payload settlement transaction (JSONB)
--   p_partial_amount          : NULL = full settle, value > 0 = partial
--   p_meta_remaining_key      : key meta untuk track sisa (default 'remaining_amount')
--   p_outstanding_amount      : sisa terkini menurut client (untuk cross-check
--                               supaya client tidak settle pakai data stale)
--
-- Return: settlement_id (UUID) + updated_meta (JSONB)
-- ============================================================

CREATE OR REPLACE FUNCTION settle_transaction(
  p_original_transaction_id UUID,
  p_settlement_data JSONB,
  p_partial_amount NUMERIC DEFAULT NULL,
  p_outstanding_amount NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  settlement_id UUID,
  updated_meta JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_original RECORD;
  v_settlement_id UUID;
  v_settlement_amount NUMERIC;
  v_outstanding NUMERIC;
  v_existing_partials JSONB;
  v_new_meta JSONB;
  v_new_remaining NUMERIC;
BEGIN
  -- Lock transaksi asli untuk mencegah concurrent settlement (lost update).
  SELECT * INTO v_original
  FROM transactions
  WHERE id = p_original_transaction_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi asli tidak ditemukan atau sudah dihapus';
  END IF;

  -- Authorization: pastikan caller adalah manager/superadmin di business asli
  IF NOT EXISTS (
    SELECT 1 FROM user_business_roles
    WHERE user_id = auth.uid()
      AND business_id = v_original.business_id
      AND role IN ('business_manager', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Tidak berhak melunasi transaksi ini';
  END IF;

  -- Cek transaksi belum lunas
  IF v_original.meta ? 'settled_by_transaction_id' THEN
    RAISE EXCEPTION 'Transaksi sudah lunas';
  END IF;

  -- Hitung sisa outstanding terkini berdasar meta (atau total amount kalau belum partial)
  v_outstanding := COALESCE(
    (v_original.meta->>'remaining_amount')::NUMERIC,
    v_original.amount
  );

  -- Cross-check dengan client (deteksi stale data — opsional)
  IF p_outstanding_amount IS NOT NULL AND ABS(p_outstanding_amount - v_outstanding) > 0.01 THEN
    RAISE EXCEPTION 'Data sisa tagihan tidak sinkron (client: %, server: %). Refresh halaman lalu coba lagi.',
      p_outstanding_amount, v_outstanding;
  END IF;

  -- Tentukan jumlah settlement
  IF p_partial_amount IS NULL THEN
    v_settlement_amount := v_outstanding;
  ELSE
    IF p_partial_amount <= 0 THEN
      RAISE EXCEPTION 'Jumlah pelunasan harus lebih dari 0';
    END IF;
    IF p_partial_amount >= v_outstanding THEN
      RAISE EXCEPTION 'Pelunasan sebagian harus < sisa tagihan (%). Gunakan full settlement.',
        v_outstanding;
    END IF;
    v_settlement_amount := p_partial_amount;
  END IF;

  -- Insert settlement transaction
  INSERT INTO transactions (
    business_id, created_by, date, category, name, description,
    amount, account, debit_account_id, credit_account_id,
    is_double_entry, notes, meta, status
  )
  VALUES (
    v_original.business_id,
    auth.uid(),
    (p_settlement_data->>'date')::DATE,
    p_settlement_data->>'category',
    p_settlement_data->>'name',
    p_settlement_data->>'description',
    v_settlement_amount,
    COALESCE(p_settlement_data->>'account', ''),
    NULLIF(p_settlement_data->>'debit_account_id', '')::UUID,
    NULLIF(p_settlement_data->>'credit_account_id', '')::UUID,
    COALESCE((p_settlement_data->>'is_double_entry')::BOOLEAN, FALSE),
    NULLIF(p_settlement_data->>'notes', ''),
    CASE
      WHEN p_settlement_data ? 'meta' AND p_settlement_data->'meta' != 'null'::jsonb
      THEN p_settlement_data->'meta'
      ELSE NULL
    END,
    COALESCE(p_settlement_data->>'status', 'posted')
  )
  RETURNING id INTO v_settlement_id;

  -- Build new meta untuk transaksi asli
  v_new_meta := COALESCE(v_original.meta, '{}'::jsonb);

  IF p_partial_amount IS NULL THEN
    -- Full settlement: tandai LUNAS
    v_new_meta := v_new_meta || jsonb_build_object(
      'settled_by_transaction_id', v_settlement_id::text,
      'remaining_amount', 0
    );
  ELSE
    -- Partial: append ke array partial_settlements + update remaining
    v_existing_partials := COALESCE(v_original.meta->'partial_settlements', '[]'::jsonb);
    v_new_remaining := v_outstanding - p_partial_amount;
    v_new_meta := v_new_meta || jsonb_build_object(
      'partial_settlements', v_existing_partials || to_jsonb(v_settlement_id::text),
      'remaining_amount', v_new_remaining
    );
  END IF;

  -- Update meta transaksi asli (atomic, masih dalam lock yang sama)
  UPDATE transactions
  SET meta = v_new_meta
  WHERE id = p_original_transaction_id;

  RETURN QUERY SELECT v_settlement_id, v_new_meta;
END;
$$;

GRANT EXECUTE ON FUNCTION settle_transaction(UUID, JSONB, NUMERIC, NUMERIC) TO authenticated;

COMMENT ON FUNCTION settle_transaction IS
  'Atomic settlement (full atau partial) untuk receivable/dividend. '
  'Menggunakan FOR UPDATE pada transaksi asli untuk mencegah lost update '
  'saat partial settlement parallel.';


-- ============================================================
-- ROLLBACK:
-- DROP FUNCTION IF EXISTS create_multi_line_transaction(UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB);
-- DROP FUNCTION IF EXISTS settle_transaction(UUID, JSONB, NUMERIC, NUMERIC);
-- ============================================================
