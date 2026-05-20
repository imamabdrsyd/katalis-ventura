-- ============================================================
-- 082_atomic_multiline_create_update_rpc.sql
--
-- Purpose:
-- - Make multi-line journal create/update truly atomic.
-- - Keep multi-currency journal line fields introduced in migration 079.
--
-- The API route should call these RPCs instead of doing header and
-- journal_lines mutations as separate database requests.
-- ============================================================

DROP FUNCTION IF EXISTS create_multi_line_transaction(
  UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB
);

CREATE OR REPLACE FUNCTION create_multi_line_transaction(
  p_header JSONB,
  p_lines JSONB
)
RETURNS SETOF transactions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
  v_transaction_id UUID;
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
  v_line_count INTEGER := 0;
  v_distinct_account_count INTEGER := 0;
  v_valid_account_count INTEGER := 0;
  v_sort_order INTEGER := 0;
  v_line JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'journal_lines harus berupa array';
  END IF;

  v_business_id := (p_header->>'business_id')::UUID;

  IF NOT EXISTS (
    SELECT 1
    FROM user_business_roles
    WHERE user_id = auth.uid()
      AND business_id = v_business_id
      AND role IN ('business_manager', 'superadmin', 'both')
  ) THEN
    RAISE EXCEPTION 'Tidak berhak membuat transaksi di bisnis ini';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM businesses b
    WHERE b.id = v_business_id
      AND b.closed_until_date IS NOT NULL
      AND (p_header->>'date')::DATE <= b.closed_until_date
  ) THEN
    RAISE EXCEPTION 'Periode transaksi sudah dikunci';
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
   AND a.business_id = v_business_id;

  IF v_distinct_account_count <> v_valid_account_count THEN
    RAISE EXCEPTION 'Semua akun jurnal harus milik bisnis yang sama';
  END IF;

  INSERT INTO transactions (
    business_id,
    date,
    category,
    name,
    description,
    notes,
    amount,
    original_amount,
    currency_code,
    fx_rate,
    fx_rate_date,
    fx_gain_loss_amount,
    account,
    status,
    is_multi_line,
    is_double_entry,
    meta,
    created_by
  )
  VALUES (
    v_business_id,
    (p_header->>'date')::DATE,
    p_header->>'category',
    p_header->>'name',
    COALESCE(p_header->>'description', ''),
    NULLIF(p_header->>'notes', ''),
    v_total_debit,
    COALESCE((NULLIF(p_header->>'original_amount', ''))::NUMERIC, v_total_debit),
    COALESCE(NULLIF(UPPER(p_header->>'currency_code'), ''), 'IDR'),
    COALESCE(NULLIF((NULLIF(p_header->>'fx_rate', ''))::NUMERIC, 0), 1),
    COALESCE((NULLIF(p_header->>'fx_rate_date', ''))::DATE, (p_header->>'date')::DATE),
    COALESCE((NULLIF(p_header->>'fx_gain_loss_amount', ''))::NUMERIC, 0),
    'Multi-line journal entry',
    COALESCE(NULLIF(p_header->>'status', ''), 'draft'),
    TRUE,
    FALSE,
    CASE
      WHEN p_header ? 'meta' AND p_header->'meta' != 'null'::jsonb
      THEN p_header->'meta'
      ELSE NULL
    END,
    auth.uid()
  )
  RETURNING id INTO v_transaction_id;

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
      v_transaction_id,
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

  RETURN QUERY
    SELECT t.*
    FROM transactions t
    WHERE t.id = v_transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_multi_line_transaction(JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION create_multi_line_transaction(JSONB, JSONB) IS
  'Atomically creates a multi-line journal transaction header and all journal_lines.';

CREATE OR REPLACE FUNCTION update_multi_line_transaction(
  p_transaction_id UUID,
  p_header JSONB,
  p_lines JSONB DEFAULT NULL
)
RETURNS SETOF transactions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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

  IF v_existing.is_multi_line IS NOT TRUE THEN
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
$$;

GRANT EXECUTE ON FUNCTION update_multi_line_transaction(UUID, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION update_multi_line_transaction(UUID, JSONB, JSONB) IS
  'Atomically updates a multi-line journal transaction header and optionally replaces journal_lines.';
