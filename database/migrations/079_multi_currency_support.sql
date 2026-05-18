-- Migration 078: Multi-currency bookkeeping support
--
-- Strategy:
-- - `amount` remains the functional/reporting amount in IDR so existing reports
--   and calculations keep working.
-- - `original_amount`, `currency_code`, and `fx_rate` preserve the source
--   currency. `fx_gain_loss_amount` records realized FX gain/loss in IDR.
-- - Account currency is tracked for future foreign-currency bank/cash accounts.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS base_currency_code TEXT NOT NULL DEFAULT 'IDR';

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'IDR';

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(20, 2),
  ADD COLUMN IF NOT EXISTS fx_rate NUMERIC(20, 8) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fx_rate_date DATE,
  ADD COLUMN IF NOT EXISTS fx_gain_loss_amount NUMERIC(20, 2) NOT NULL DEFAULT 0;

ALTER TABLE journal_lines
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS original_debit_amount NUMERIC(20, 2),
  ADD COLUMN IF NOT EXISTS original_credit_amount NUMERIC(20, 2),
  ADD COLUMN IF NOT EXISTS fx_rate NUMERIC(20, 8) NOT NULL DEFAULT 1;

UPDATE businesses
SET base_currency_code = 'IDR'
WHERE base_currency_code IS NULL OR base_currency_code = '';

UPDATE accounts
SET currency_code = 'IDR'
WHERE currency_code IS NULL OR currency_code = '';

UPDATE transactions
SET
  currency_code = COALESCE(NULLIF(currency_code, ''), 'IDR'),
  original_amount = COALESCE(original_amount, amount),
  fx_rate = COALESCE(NULLIF(fx_rate, 0), 1),
  fx_rate_date = COALESCE(fx_rate_date, date),
  fx_gain_loss_amount = COALESCE(fx_gain_loss_amount, 0);

UPDATE journal_lines
SET
  currency_code = COALESCE(NULLIF(currency_code, ''), 'IDR'),
  original_debit_amount = COALESCE(original_debit_amount, debit_amount),
  original_credit_amount = COALESCE(original_credit_amount, credit_amount),
  fx_rate = COALESCE(NULLIF(fx_rate, 0), 1);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'businesses_base_currency_code_check') THEN
    ALTER TABLE businesses
      ADD CONSTRAINT businesses_base_currency_code_check
      CHECK (base_currency_code ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_currency_code_check') THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_currency_code_check
      CHECK (currency_code ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_currency_code_check') THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_currency_code_check
      CHECK (currency_code ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_original_amount_positive') THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_original_amount_positive
      CHECK (original_amount IS NULL OR original_amount > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_fx_rate_positive') THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_fx_rate_positive
      CHECK (fx_rate > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_lines_currency_code_check') THEN
    ALTER TABLE journal_lines
      ADD CONSTRAINT journal_lines_currency_code_check
      CHECK (currency_code ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_lines_fx_rate_positive') THEN
    ALTER TABLE journal_lines
      ADD CONSTRAINT journal_lines_fx_rate_positive
      CHECK (fx_rate > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounts_business_currency
  ON accounts (business_id, currency_code);

CREATE INDEX IF NOT EXISTS idx_transactions_business_currency
  ON transactions (business_id, currency_code)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN businesses.base_currency_code IS
  'Functional/reporting currency for this business. Current reports use IDR.';
COMMENT ON COLUMN accounts.currency_code IS
  'Currency tracked by this account. Defaults to IDR; useful for foreign-currency cash/bank accounts.';
COMMENT ON COLUMN transactions.amount IS
  'Functional/reporting amount in IDR. For foreign-currency transactions this equals original_amount * fx_rate.';
COMMENT ON COLUMN transactions.original_amount IS
  'Original transaction amount before conversion to IDR.';
COMMENT ON COLUMN transactions.currency_code IS
  'ISO-4217 currency code for original_amount.';
COMMENT ON COLUMN transactions.fx_rate IS
  'Exchange rate used for recognition: IDR per 1 unit of currency_code.';
COMMENT ON COLUMN transactions.fx_gain_loss_amount IS
  'Realized FX gain/loss in IDR. Positive = gain, negative = loss.';

-- Add default FX gain/loss accounts for existing businesses.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      b.id AS business_id,
      rev.id AS revenue_parent_id,
      exp.id AS expense_parent_id
    FROM businesses b
    LEFT JOIN accounts rev
      ON rev.business_id = b.id AND rev.account_code = '4000'
    LEFT JOIN accounts exp
      ON exp.business_id = b.id AND exp.account_code = '5000'
  LOOP
    IF rec.revenue_parent_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM accounts a WHERE a.business_id = rec.business_id AND a.account_code = '4200'
    ) THEN
      INSERT INTO accounts (
        business_id, account_code, account_name, account_type, parent_account_id,
        normal_balance, is_system, sort_order, description, default_category, currency_code
      )
      VALUES (
        rec.business_id, '4200', 'FX Gain', 'REVENUE', rec.revenue_parent_id,
        'CREDIT', TRUE, 4200, 'Keuntungan selisih kurs terealisasi', 'FIN', 'IDR'
      );
    END IF;

    IF rec.expense_parent_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM accounts a WHERE a.business_id = rec.business_id AND a.account_code = '5400'
    ) THEN
      INSERT INTO accounts (
        business_id, account_code, account_name, account_type, parent_account_id,
        normal_balance, is_system, sort_order, description, default_category, currency_code
      )
      VALUES (
        rec.business_id, '5400', 'FX Loss', 'EXPENSE', rec.expense_parent_id,
        'DEBIT', TRUE, 5400, 'Kerugian selisih kurs terealisasi', 'FIN', 'IDR'
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION replace_journal_lines(
  p_transaction_id UUID,
  p_lines JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
  v_line JSONB;
BEGIN
  SELECT business_id INTO v_business_id
  FROM transactions t
  WHERE t.id = p_transaction_id
    AND t.deleted_at IS NULL;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found or deleted';
  END IF;

  DELETE FROM journal_lines WHERE transaction_id = p_transaction_id;

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
      COALESCE((v_line->>'original_debit_amount')::NUMERIC, (v_line->>'debit_amount')::NUMERIC, 0),
      COALESCE((v_line->>'original_credit_amount')::NUMERIC, (v_line->>'credit_amount')::NUMERIC, 0),
      COALESCE(NULLIF((v_line->>'fx_rate')::NUMERIC, 0), 1),
      NULLIF(v_line->>'description', ''),
      COALESCE((v_line->>'sort_order')::INTEGER, 0)
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION replace_journal_lines(UUID, JSONB) TO authenticated;

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
  v_settlement_meta JSONB;
  v_currency_code TEXT;
  v_original_amount NUMERIC;
  v_fx_rate NUMERIC;
  v_actual_base_amount NUMERIC;
  v_fx_gain_loss NUMERIC := 0;
  v_debit_account_id UUID;
  v_credit_account_id UUID;
  v_is_receivable BOOLEAN := FALSE;
  v_is_payable BOOLEAN := FALSE;
  v_fx_gain_account_id UUID;
  v_fx_loss_account_id UUID;
  v_header_amount NUMERIC;
BEGIN
  SELECT * INTO v_original
  FROM transactions
  WHERE id = p_original_transaction_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi asli tidak ditemukan atau sudah dihapus';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_business_roles
    WHERE user_id = auth.uid()
      AND business_id = v_original.business_id
      AND role IN ('business_manager', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Tidak berhak melunasi transaksi ini';
  END IF;

  IF v_original.meta ? 'settled_by_transaction_id' THEN
    RAISE EXCEPTION 'Transaksi sudah lunas';
  END IF;

  v_outstanding := COALESCE(
    (v_original.meta->>'remaining_amount')::NUMERIC,
    v_original.amount
  );

  IF p_outstanding_amount IS NOT NULL AND ABS(p_outstanding_amount - v_outstanding) > 0.01 THEN
    RAISE EXCEPTION 'Data sisa tagihan tidak sinkron (client: %, server: %). Refresh halaman lalu coba lagi.',
      p_outstanding_amount, v_outstanding;
  END IF;

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

  v_currency_code := COALESCE(
    NULLIF(UPPER(p_settlement_data->>'currency_code'), ''),
    NULLIF(UPPER(v_original.currency_code), ''),
    'IDR'
  );
  v_original_amount := COALESCE(
    (NULLIF(p_settlement_data->>'original_amount', ''))::NUMERIC,
    v_settlement_amount
  );
  v_fx_rate := CASE
    WHEN v_currency_code = 'IDR' THEN 1
    ELSE COALESCE((NULLIF(p_settlement_data->>'fx_rate', ''))::NUMERIC, v_original.fx_rate, 1)
  END;
  v_actual_base_amount := CASE
    WHEN v_currency_code = 'IDR' THEN v_settlement_amount
    ELSE ROUND(v_original_amount * v_fx_rate, 2)
  END;

  v_debit_account_id := NULLIF(p_settlement_data->>'debit_account_id', '')::UUID;
  v_credit_account_id := NULLIF(p_settlement_data->>'credit_account_id', '')::UUID;
  v_is_receivable := v_original.debit_account_id IS NOT NULL AND v_original.debit_account_id = v_credit_account_id;
  v_is_payable := v_original.credit_account_id IS NOT NULL AND v_original.credit_account_id = v_debit_account_id;

  IF p_partial_amount IS NULL
     AND v_currency_code <> 'IDR'
     AND ABS(v_actual_base_amount - v_settlement_amount) > 0.01
     AND (v_is_receivable OR v_is_payable) THEN
    IF v_is_receivable THEN
      v_fx_gain_loss := v_actual_base_amount - v_settlement_amount;
    ELSE
      v_fx_gain_loss := v_settlement_amount - v_actual_base_amount;
    END IF;

    SELECT id INTO v_fx_gain_account_id
    FROM accounts
    WHERE business_id = v_original.business_id
      AND account_code = '4200'
      AND account_type = 'REVENUE'
      AND is_active = TRUE
    LIMIT 1;

    SELECT id INTO v_fx_loss_account_id
    FROM accounts
    WHERE business_id = v_original.business_id
      AND account_code = '5400'
      AND account_type = 'EXPENSE'
      AND is_active = TRUE
    LIMIT 1;

    IF v_fx_gain_loss > 0 AND v_fx_gain_account_id IS NULL THEN
      RAISE EXCEPTION 'Akun FX Gain (4200) tidak ditemukan';
    END IF;

    IF v_fx_gain_loss < 0 AND v_fx_loss_account_id IS NULL THEN
      RAISE EXCEPTION 'Akun FX Loss (5400) tidak ditemukan';
    END IF;

    v_header_amount := CASE
      WHEN v_is_receivable AND v_fx_gain_loss >= 0 THEN v_actual_base_amount
      WHEN v_is_receivable AND v_fx_gain_loss < 0 THEN v_settlement_amount
      WHEN v_is_payable AND v_fx_gain_loss >= 0 THEN v_settlement_amount
      ELSE v_actual_base_amount
    END;

    v_settlement_meta := COALESCE(
      CASE
        WHEN p_settlement_data ? 'meta' AND p_settlement_data->'meta' != 'null'::jsonb
        THEN p_settlement_data->'meta'
        ELSE NULL
      END,
      '{}'::jsonb
    ) || jsonb_build_object(
      'fx_gain_loss_amount', v_fx_gain_loss,
      'fx_carrying_amount', v_settlement_amount,
      'fx_settlement_base_amount', v_actual_base_amount
    );

    INSERT INTO transactions (
      business_id, created_by, date, category, name, description,
      amount, original_amount, currency_code, fx_rate, fx_rate_date,
      fx_gain_loss_amount, account, debit_account_id, credit_account_id,
      is_double_entry, is_multi_line, notes, meta, status
    )
    VALUES (
      v_original.business_id,
      auth.uid(),
      (p_settlement_data->>'date')::DATE,
      p_settlement_data->>'category',
      p_settlement_data->>'name',
      p_settlement_data->>'description',
      v_header_amount,
      v_original_amount,
      v_currency_code,
      v_fx_rate,
      COALESCE((NULLIF(p_settlement_data->>'fx_rate_date', ''))::DATE, (p_settlement_data->>'date')::DATE),
      v_fx_gain_loss,
      'FX settlement journal',
      NULL,
      NULL,
      FALSE,
      TRUE,
      NULLIF(p_settlement_data->>'notes', ''),
      v_settlement_meta,
      COALESCE(p_settlement_data->>'status', 'posted')
    )
    RETURNING id INTO v_settlement_id;

    IF v_is_receivable THEN
      INSERT INTO journal_lines (transaction_id, account_id, debit_amount, credit_amount, description, sort_order)
      VALUES (v_settlement_id, v_debit_account_id, v_actual_base_amount, 0, 'Kas diterima pada kurs settlement', 0);

      IF v_fx_gain_loss >= 0 THEN
        INSERT INTO journal_lines (transaction_id, account_id, debit_amount, credit_amount, description, sort_order)
        VALUES
          (v_settlement_id, v_credit_account_id, 0, v_settlement_amount, 'Pelunasan nilai tercatat piutang', 1),
          (v_settlement_id, v_fx_gain_account_id, 0, ABS(v_fx_gain_loss), 'Keuntungan selisih kurs terealisasi', 2);
      ELSE
        INSERT INTO journal_lines (transaction_id, account_id, debit_amount, credit_amount, description, sort_order)
        VALUES
          (v_settlement_id, v_fx_loss_account_id, ABS(v_fx_gain_loss), 0, 'Kerugian selisih kurs terealisasi', 1),
          (v_settlement_id, v_credit_account_id, 0, v_settlement_amount, 'Pelunasan nilai tercatat piutang', 2);
      END IF;
    ELSE
      INSERT INTO journal_lines (transaction_id, account_id, debit_amount, credit_amount, description, sort_order)
      VALUES (v_settlement_id, v_debit_account_id, v_settlement_amount, 0, 'Pelunasan nilai tercatat hutang', 0);

      IF v_fx_gain_loss >= 0 THEN
        INSERT INTO journal_lines (transaction_id, account_id, debit_amount, credit_amount, description, sort_order)
        VALUES
          (v_settlement_id, v_credit_account_id, 0, v_actual_base_amount, 'Kas dibayar pada kurs settlement', 1),
          (v_settlement_id, v_fx_gain_account_id, 0, ABS(v_fx_gain_loss), 'Keuntungan selisih kurs terealisasi', 2);
      ELSE
        INSERT INTO journal_lines (transaction_id, account_id, debit_amount, credit_amount, description, sort_order)
        VALUES
          (v_settlement_id, v_fx_loss_account_id, ABS(v_fx_gain_loss), 0, 'Kerugian selisih kurs terealisasi', 1),
          (v_settlement_id, v_credit_account_id, 0, v_actual_base_amount, 'Kas dibayar pada kurs settlement', 2);
      END IF;
    END IF;
  ELSE
    INSERT INTO transactions (
      business_id, created_by, date, category, name, description,
      amount, original_amount, currency_code, fx_rate, fx_rate_date,
      fx_gain_loss_amount, account, debit_account_id, credit_account_id,
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
      v_original_amount,
      v_currency_code,
      v_fx_rate,
      COALESCE((NULLIF(p_settlement_data->>'fx_rate_date', ''))::DATE, (p_settlement_data->>'date')::DATE),
      COALESCE((NULLIF(p_settlement_data->>'fx_gain_loss_amount', ''))::NUMERIC, 0),
      COALESCE(p_settlement_data->>'account', ''),
      v_debit_account_id,
      v_credit_account_id,
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
  END IF;

  v_new_meta := COALESCE(v_original.meta, '{}'::jsonb);

  IF p_partial_amount IS NULL THEN
    v_new_meta := v_new_meta || jsonb_build_object(
      'settled_by_transaction_id', v_settlement_id::text,
      'remaining_amount', 0,
      'fx_gain_loss_amount', v_fx_gain_loss
    );
  ELSE
    v_existing_partials := COALESCE(v_original.meta->'partial_settlements', '[]'::jsonb);
    v_new_remaining := v_outstanding - p_partial_amount;
    v_new_meta := v_new_meta || jsonb_build_object(
      'partial_settlements', v_existing_partials || to_jsonb(v_settlement_id::text),
      'remaining_amount', v_new_remaining
    );
  END IF;

  UPDATE transactions
  SET meta = v_new_meta
  WHERE id = p_original_transaction_id;

  RETURN QUERY SELECT v_settlement_id, v_new_meta;
END;
$$;

GRANT EXECUTE ON FUNCTION settle_transaction(UUID, JSONB, NUMERIC, NUMERIC) TO authenticated;

-- Keep future businesses aligned with the new default chart of accounts.
CREATE OR REPLACE FUNCTION public.create_default_accounts(p_business_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_asset_id UUID;
    v_liability_id UUID;
    v_equity_id UUID;
    v_revenue_id UUID;
    v_expense_id UUID;
BEGIN
    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description, currency_code)
    VALUES (p_business_id, '1000', 'Assets', 'ASSET', NULL, 'DEBIT', TRUE, 1000, 'Semua aset bisnis', 'IDR')
    RETURNING id INTO v_asset_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description, currency_code)
    VALUES (p_business_id, '2000', 'Liabilities', 'LIABILITY', NULL, 'CREDIT', TRUE, 2000, 'Semua kewajiban bisnis', 'IDR')
    RETURNING id INTO v_liability_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description, currency_code)
    VALUES (p_business_id, '3000', 'Equity', 'EQUITY', NULL, 'CREDIT', TRUE, 3000, 'Modal dan ekuitas pemilik', 'IDR')
    RETURNING id INTO v_equity_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description, currency_code)
    VALUES (p_business_id, '4000', 'Revenue', 'REVENUE', NULL, 'CREDIT', TRUE, 4000, 'Semua pendapatan bisnis', 'IDR')
    RETURNING id INTO v_revenue_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description, currency_code)
    VALUES (p_business_id, '5000', 'Expenses', 'EXPENSE', NULL, 'DEBIT', TRUE, 5000, 'Semua beban bisnis', 'IDR')
    RETURNING id INTO v_expense_id;

    INSERT INTO accounts (
      business_id,
      account_code,
      account_name,
      account_type,
      parent_account_id,
      normal_balance,
      is_system,
      sort_order,
      description,
      default_category,
      is_retained_earnings,
      is_cash_equivalent,
      is_stock,
      currency_code
    ) VALUES
    (p_business_id, '1100', 'Cash', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1100, 'Kas tunai', NULL, FALSE, TRUE, FALSE, 'IDR'),
    (p_business_id, '1200', 'Bank', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1200, 'Rekening bank', NULL, FALSE, TRUE, FALSE, 'IDR'),
    (p_business_id, '1300', 'Fixed Assets', 'ASSET', v_asset_id, 'DEBIT', FALSE, 1300, 'Aset tetap / peralatan', 'CAPEX', FALSE, FALSE, FALSE, 'IDR'),
    (p_business_id, '2100', 'Loans Payable', 'LIABILITY', v_liability_id, 'CREDIT', FALSE, 2100, 'Utang pinjaman', 'FIN', FALSE, FALSE, FALSE, 'IDR'),
    (p_business_id, '3100', 'Owner''s Capital', 'EQUITY', v_equity_id, 'CREDIT', TRUE, 3100, 'Modal pemilik', 'FIN', FALSE, FALSE, TRUE, 'IDR'),
    (p_business_id, '3200', 'Retained Earnings', 'EQUITY', v_equity_id, 'CREDIT', TRUE, 3200, 'Laba ditahan dari operasi bisnis', 'FIN', TRUE, FALSE, FALSE, 'IDR'),
    (p_business_id, '4100', 'Sales Revenue', 'REVENUE', v_revenue_id, 'CREDIT', TRUE, 4100, 'Pendapatan penjualan', 'EARN', FALSE, FALSE, FALSE, 'IDR'),
    (p_business_id, '4200', 'FX Gain', 'REVENUE', v_revenue_id, 'CREDIT', TRUE, 4200, 'Keuntungan selisih kurs terealisasi', 'FIN', FALSE, FALSE, FALSE, 'IDR'),
    (p_business_id, '5100', 'Operating Expenses', 'EXPENSE', v_expense_id, 'DEBIT', TRUE, 5100, 'Beban operasional', 'OPEX', FALSE, FALSE, FALSE, 'IDR'),
    (p_business_id, '5200', 'Variable Cost (COGS)', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5200, 'Biaya variabel / harga pokok penjualan', 'VAR', FALSE, FALSE, FALSE, 'IDR'),
    (p_business_id, '5300', 'Tax Expenses', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5300, 'Beban pajak', 'TAX', FALSE, FALSE, FALSE, 'IDR'),
    (p_business_id, '5400', 'FX Loss', 'EXPENSE', v_expense_id, 'DEBIT', TRUE, 5400, 'Kerugian selisih kurs terealisasi', 'FIN', FALSE, FALSE, FALSE, 'IDR');
END;
$function$;

SELECT 'Migration 078 complete - multi-currency columns, FX accounts, and defaults added' as status;
