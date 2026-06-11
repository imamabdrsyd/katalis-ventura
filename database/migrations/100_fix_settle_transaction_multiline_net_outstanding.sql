-- Migration 100: Fix settle_transaction outstanding amount for multi-line receivables
--
-- Konteks (Issue #26 — sisi server, melengkapi fix sisi client):
--   Fix Issue #26 sebelumnya hanya diterapkan di client. `getOutstandingAmount()`
--   (src/lib/accounting/guidance/receivableSettlement.ts) mengirim outstanding = NET
--   nilai baris akun piutang. Namun RPC server `settle_transaction` (migration 079)
--   masih menghitung `v_outstanding` dari `v_original.amount` = header amount, yang
--   untuk transaksi MULTI-LINE adalah total debit (GROSS), bukan nilai piutang.
--
--   Akibatnya, pada penjualan multi-line (mis. OTA: Dr Piutang 969.563
--   + Dr beban komisi/biaya/pajak / Cr Pendapatan 1.200.000):
--     - Client kirim outstanding 969.563 (net), server hitung 1.200.000 (gross)
--       → sync-check `ABS(diff) > 0.01` raise exception → PELUNASAN MUSTAHIL.
--     - Bila outstanding dikirim NULL, server melunasi di GROSS 1.200.000
--       → kas masuk & pelunasan piutang meng-overstate sebesar beban (regresi #26).
--
-- Perbaikan:
--   `v_outstanding` kini sadar bentuk transaksi:
--     1. Partial settlement → meta.remaining_amount (tidak berubah, sama spt client).
--     2. Multi-line first settlement → SUM(debit - credit) baris akun PIUTANG saja.
--        Aturan "any receivable account" direplikasi PERSIS dari
--        isAnyReceivableAccount() di src/lib/accounting/classification.ts agar cocok
--        dengan client getReceivableLineAmount() — JAGA KEDUANYA TETAP SINKRON.
--     3. Single double-entry → header `amount` (baris piutang = seluruh amount),
--        perilaku tidak berubah.
--
--   Hanya blok perhitungan v_outstanding yang diubah; sisa fungsi identik dgn migr 079.
--   Tetap SECURITY INVOKER + SET search_path = public.

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

  -- Outstanding (sisa tagihan) — HARUS cocok dengan client getOutstandingAmount()
  -- (src/lib/accounting/guidance/receivableSettlement.ts), jika tidak sync-check di
  -- bawah akan menolak settlement yang valid (Issue #26 sisi server — lihat header).
  IF v_original.meta ? 'remaining_amount' THEN
    -- Partial settlement berikutnya: pakai sisa yang sudah dicatat (sama spt client).
    v_outstanding := (v_original.meta->>'remaining_amount')::NUMERIC;
  ELSIF v_original.is_multi_line THEN
    -- Multi-line: net debit baris akun PIUTANG saja (BUKAN header amount/gross).
    -- Kondisi di bawah = replika isAnyReceivableAccount() utk akun ASSET:
    --   is_trade_receivable=TRUE  OR  default_category IN (FIN,EARN)  OR  nama match.
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

SELECT 'Migration 100 complete - settle_transaction multi-line net outstanding (Issue #26 server-side)' as status;
