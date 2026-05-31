-- Migration 095: Izinkan promosi transaksi double-entry → multi-line journal.
--
-- Sebelumnya `update_multi_line_transaction` menolak transaksi yang `is_multi_line`
-- masih FALSE ("Transaksi ini bukan jurnal multi-line"). Ini memblokir fitur
-- "Tambah Baris" di edit form yang meng-upgrade transaksi double-entry sederhana
-- menjadi multi-line.
--
-- Perubahan:
--   1. Tolak hanya jika BUKAN multi-line DAN tidak ada p_lines (tak bisa konversi
--      tanpa baris jurnal). Jika p_lines disediakan, perlakukan sebagai PROMOSI.
--   2. Saat promosi (p_lines disediakan), set is_multi_line = TRUE, is_double_entry
--      = TRUE, dan kosongkan debit_account_id / credit_account_id agar memenuhi
--      constraint `transactions_account_rules` (multi-line wajib NULL pada kedua
--      kolom akun single-line).

CREATE OR REPLACE FUNCTION public.update_multi_line_transaction(p_transaction_id uuid, p_header jsonb, p_lines jsonb DEFAULT NULL::jsonb)
 RETURNS SETOF transactions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing RECORD;
  v_effective_date DATE;
  v_is_superadmin BOOLEAN := FALSE;
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
  v_line_count INTEGER := 0;
  v_distinct_account_count INTEGER := 0;
  v_valid_account_count INTEGER := 0;
  v_sort_order INTEGER := 0;
  v_line JSONB;
  v_header_key_count INTEGER := 0;
  v_is_status_only_post BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi';
  END IF;

  SELECT *
  INTO v_existing
  FROM transactions
  WHERE id = p_transaction_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan';
  END IF;

  -- Tolak hanya kalau bukan multi-line DAN tak ada baris jurnal untuk konversi.
  -- Bila p_lines disediakan, ini adalah PROMOSI double-entry → multi-line.
  IF v_existing.is_multi_line IS NOT TRUE AND p_lines IS NULL THEN
    RAISE EXCEPTION 'Transaksi ini bukan jurnal multi-line';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM user_business_roles
    WHERE user_id = auth.uid()
      AND business_id = v_existing.business_id
      AND role = 'superadmin'
  ) INTO v_is_superadmin;

  IF NOT EXISTS (
    SELECT 1
    FROM user_business_roles
    WHERE user_id = auth.uid()
      AND business_id = v_existing.business_id
      AND role IN ('business_manager', 'superadmin', 'both')
  ) THEN
    RAISE EXCEPTION 'Tidak berhak mengubah transaksi ini';
  END IF;

  SELECT COUNT(*) INTO v_header_key_count
  FROM jsonb_object_keys(COALESCE(p_header, '{}'::jsonb));

  v_is_status_only_post :=
    v_header_key_count = 1
    AND p_header ? 'status'
    AND p_header->>'status' = 'posted'
    AND p_lines IS NULL;

  IF v_existing.status = 'posted' AND NOT v_is_status_only_post AND NOT v_is_superadmin THEN
    RAISE EXCEPTION 'Transaksi yang sudah di-posting tidak dapat diedit';
  END IF;

  v_effective_date := COALESCE((NULLIF(p_header->>'date', ''))::DATE, v_existing.date);

  IF EXISTS (
    SELECT 1
    FROM businesses b
    WHERE b.id = v_existing.business_id
      AND b.closed_until_date IS NOT NULL
      AND (
        v_existing.date <= b.closed_until_date
        OR v_effective_date <= b.closed_until_date
      )
      AND NOT v_is_superadmin
  ) THEN
    RAISE EXCEPTION 'Periode transaksi sudah dikunci';
  END IF;

  IF p_lines IS NOT NULL THEN
    IF jsonb_typeof(p_lines) <> 'array' THEN
      RAISE EXCEPTION 'journal_lines harus berupa array';
    END IF;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      v_line_count := v_line_count + 1;
      v_total_debit := v_total_debit + COALESCE((v_line->>'debit_amount')::NUMERIC, 0);
      v_total_credit := v_total_credit + COALESCE((v_line->>'credit_amount')::NUMERIC, 0);

      IF (
        COALESCE((v_line->>'debit_amount')::NUMERIC, 0) <= 0
        AND COALESCE((v_line->>'credit_amount')::NUMERIC, 0) <= 0
      ) OR (
        COALESCE((v_line->>'debit_amount')::NUMERIC, 0) > 0
        AND COALESCE((v_line->>'credit_amount')::NUMERIC, 0) > 0
      ) THEN
        RAISE EXCEPTION 'Setiap baris jurnal harus memiliki debit atau kredit saja';
      END IF;
    END LOOP;

    IF v_line_count < 2 THEN
      RAISE EXCEPTION 'Multi-line journal harus memiliki minimal 2 baris';
    END IF;

    IF v_total_debit <= 0 THEN
      RAISE EXCEPTION 'Jumlah transaksi harus lebih dari 0';
    END IF;

    IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
      RAISE EXCEPTION 'Jurnal tidak seimbang: total debit (%) != total credit (%)',
        v_total_debit, v_total_credit;
    END IF;

    SELECT
      COUNT(DISTINCT line.value->>'account_id'),
      COUNT(DISTINCT a.id)
    INTO v_distinct_account_count, v_valid_account_count
    FROM jsonb_array_elements(p_lines) AS line(value)
    LEFT JOIN accounts a
      ON a.id = (line.value->>'account_id')::UUID
     AND a.business_id = v_existing.business_id;

    IF v_distinct_account_count <> v_valid_account_count THEN
      RAISE EXCEPTION 'Semua akun jurnal harus milik bisnis yang sama';
    END IF;
  END IF;

  UPDATE transactions
  SET
    date = v_effective_date,
    category = COALESCE(p_header->>'category', category),
    name = COALESCE(p_header->>'name', name),
    description = COALESCE(p_header->>'description', description),
    notes = CASE WHEN p_header ? 'notes' THEN NULLIF(p_header->>'notes', '') ELSE notes END,
    status = COALESCE(p_header->>'status', status),
    meta = CASE
      WHEN p_header ? 'meta' AND p_header->'meta' != 'null'::jsonb THEN p_header->'meta'
      WHEN p_header ? 'meta' THEN NULL
      ELSE meta
    END,
    -- Promosi double-entry → multi-line saat p_lines disediakan.
    -- Constraint transactions_account_rules: multi-line wajib NULL kedua kolom akun.
    is_multi_line = CASE WHEN p_lines IS NOT NULL THEN TRUE ELSE is_multi_line END,
    is_double_entry = CASE WHEN p_lines IS NOT NULL THEN TRUE ELSE is_double_entry END,
    debit_account_id = CASE WHEN p_lines IS NOT NULL THEN NULL ELSE debit_account_id END,
    credit_account_id = CASE WHEN p_lines IS NOT NULL THEN NULL ELSE credit_account_id END,
    amount = CASE WHEN p_lines IS NOT NULL THEN v_total_debit ELSE amount END,
    original_amount = CASE
      WHEN p_header ? 'original_amount' THEN (NULLIF(p_header->>'original_amount', ''))::NUMERIC
      WHEN p_lines IS NOT NULL THEN COALESCE(original_amount, v_total_debit)
      ELSE original_amount
    END,
    currency_code = CASE
      WHEN p_header ? 'currency_code' THEN COALESCE(NULLIF(UPPER(p_header->>'currency_code'), ''), 'IDR')
      ELSE currency_code
    END,
    fx_rate = CASE
      WHEN p_header ? 'fx_rate' THEN COALESCE(NULLIF((NULLIF(p_header->>'fx_rate', ''))::NUMERIC, 0), 1)
      ELSE fx_rate
    END,
    fx_rate_date = CASE
      WHEN p_header ? 'fx_rate_date' THEN (NULLIF(p_header->>'fx_rate_date', ''))::DATE
      ELSE fx_rate_date
    END,
    fx_gain_loss_amount = CASE
      WHEN p_header ? 'fx_gain_loss_amount' THEN COALESCE((NULLIF(p_header->>'fx_gain_loss_amount', ''))::NUMERIC, 0)
      ELSE fx_gain_loss_amount
    END,
    posted_at = CASE
      WHEN p_header->>'status' = 'posted' AND v_existing.status = 'draft' THEN NOW()
      ELSE posted_at
    END,
    updated_by = auth.uid()
  WHERE id = p_transaction_id;

  IF p_lines IS NOT NULL THEN
    DELETE FROM journal_lines
    WHERE transaction_id = p_transaction_id;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      INSERT INTO journal_lines (
        transaction_id,
        account_id,
        debit_amount,
        credit_amount,
        currency_code,
        original_debit_amount,
        original_credit_amount,
        fx_rate,
        description,
        sort_order
      )
      VALUES (
        p_transaction_id,
        (v_line->>'account_id')::UUID,
        COALESCE((v_line->>'debit_amount')::NUMERIC, 0),
        COALESCE((v_line->>'credit_amount')::NUMERIC, 0),
        COALESCE(NULLIF(UPPER(v_line->>'currency_code'), ''), 'IDR'),
        COALESCE((NULLIF(v_line->>'original_debit_amount', ''))::NUMERIC, (v_line->>'debit_amount')::NUMERIC, 0),
        COALESCE((NULLIF(v_line->>'original_credit_amount', ''))::NUMERIC, (v_line->>'credit_amount')::NUMERIC, 0),
        COALESCE(NULLIF((NULLIF(v_line->>'fx_rate', ''))::NUMERIC, 0), 1),
        NULLIF(v_line->>'description', ''),
        COALESCE((v_line->>'sort_order')::INTEGER, v_sort_order)
      );
      v_sort_order := v_sort_order + 1;
    END LOOP;
  END IF;

  RETURN QUERY
    SELECT t.*
    FROM transactions t
    WHERE t.id = p_transaction_id;
END;
$function$;
