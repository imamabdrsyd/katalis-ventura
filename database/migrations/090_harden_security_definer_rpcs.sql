-- Migration 090: Hardening SECURITY DEFINER RPC & RLS invite_codes (CRIT-03 + CRIT-06)
--
-- Masalah yang ditutup:
--
-- 1. CRIT-03a: use_invite_code(p_code, p_user_id)
--    - Parameter p_user_id menerima UUID arbitrary; klien jahat bisa panggil
--      RPC langsung untuk insert membership atas nama user lain.
--    - Function membaca profiles.default_role dan mempromosikan redeemer ke
--      'superadmin' kalau profile flag itu di-set (vector bersama CRIT-01).
--
-- 2. CRIT-03b: RLS invite_codes SELECT terlalu permisif
--    - Policy lama: USING (is_active = TRUE) -> setiap user terautentikasi
--      bisa SELECT semua kode aktif di seluruh platform; tinggal redeem
--      untuk masuk bisnis acak.
--
-- 3. CRIT-06: soft_delete_transaction / restore_transaction /
--    create_default_accounts adalah SECURITY DEFINER tanpa auth check.
--    Setiap user terautentikasi yang mengetahui UUID bisa hapus/restore
--    transaksi mana saja, atau memicu insert akun ke bisnis orang lain.
--
-- Fix:
-- - Replace use_invite_code -> single-arg, gunakan auth.uid() di body.
--   Drop lookup default_role; role yang diberikan murni v_invite.role.
-- - Drop policy SELECT lama di invite_codes; ganti dengan kombinasi:
--     (a) manager bisnis pemilik bisa lihat semua kode bisnisnya,
--     (b) redemption tidak butuh SELECT direct karena RPC SECURITY DEFINER.
-- - Tambah auth check di soft_delete_transaction, restore_transaction,
--   create_default_accounts.

-- =====================================================================
-- 1) use_invite_code: single-arg, anti-spoof
-- =====================================================================

DROP FUNCTION IF EXISTS use_invite_code(TEXT, UUID);

CREATE OR REPLACE FUNCTION use_invite_code(p_code TEXT)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  business_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite invite_codes%ROWTYPE;
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Tidak terautentikasi'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT * INTO v_invite
  FROM invite_codes
  WHERE code = UPPER(p_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Kode undangan tidak valid'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF NOT v_invite.is_active THEN
    RETURN QUERY SELECT FALSE, 'Kode undangan sudah tidak aktif'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, 'Kode undangan sudah kadaluarsa'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_invite.current_uses >= v_invite.max_uses THEN
    RETURN QUERY SELECT FALSE, 'Kode undangan sudah mencapai batas penggunaan'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_business_roles
    WHERE user_id = v_user AND user_business_roles.business_id = v_invite.business_id
  ) THEN
    RETURN QUERY SELECT FALSE, 'Anda sudah tergabung di bisnis ini'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  UPDATE invite_codes
  SET current_uses = current_uses + 1
  WHERE id = v_invite.id;

  INSERT INTO user_business_roles (user_id, business_id, role, invited_by)
  VALUES (v_user, v_invite.business_id, v_invite.role, v_invite.created_by);

  RETURN QUERY SELECT TRUE, NULL::TEXT, v_invite.business_id;
END;
$$;

GRANT EXECUTE ON FUNCTION use_invite_code(TEXT) TO authenticated;

COMMENT ON FUNCTION use_invite_code IS
  'Redeem invite code untuk join business. user_id selalu auth.uid(); role diambil apa adanya dari invite_codes.role (tanpa lookup profiles.default_role).';

-- =====================================================================
-- 2) RLS invite_codes: hanya manager bisnis pemilik yang boleh SELECT
-- =====================================================================

DROP POLICY IF EXISTS "Users can view active invite codes" ON invite_codes;

CREATE POLICY "Managers can view their business invite codes"
  ON invite_codes FOR SELECT
  USING (is_business_manager(business_id));

-- =====================================================================
-- 3) soft_delete_transaction: auth + role check
-- =====================================================================

CREATE OR REPLACE FUNCTION soft_delete_transaction(transaction_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM transactions t
    WHERE t.id = transaction_id
      AND t.deleted_at IS NULL
      AND is_business_manager(t.business_id)
  ) THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan atau tidak berhak menghapus'
      USING ERRCODE = '42501';
  END IF;

  UPDATE transactions
  SET deleted_at = NOW(),
      deleted_by = auth.uid()
  WHERE id = transaction_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or already deleted: %', transaction_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION soft_delete_transaction IS
  'Soft-delete transaksi. Membutuhkan manager/superadmin di bisnis terkait. Auth dicek di function (bypass RLS karena SECURITY DEFINER).';

-- =====================================================================
-- 4) restore_transaction: auth + role check
-- =====================================================================

CREATE OR REPLACE FUNCTION restore_transaction(transaction_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  UPDATE transactions
  SET deleted_at = NULL,
      deleted_by = NULL
  WHERE id = transaction_id
    AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or not deleted: %', transaction_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION restore_transaction IS
  'Restore soft-deleted transaksi. Membutuhkan manager/superadmin di bisnis terkait.';

-- =====================================================================
-- 5) create_default_accounts: hanya creator atau manager bisnis target
-- =====================================================================

CREATE OR REPLACE FUNCTION create_default_accounts(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_asset_id UUID;
    v_liability_id UUID;
    v_equity_id UUID;
    v_revenue_id UUID;
    v_expense_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Tidak terautentikasi' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = p_business_id
        AND (b.created_by = auth.uid() OR is_business_manager(b.id))
    ) THEN
      RAISE EXCEPTION 'Tidak berhak meng-provision Chart of Accounts untuk bisnis ini'
        USING ERRCODE = '42501';
    END IF;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description)
    VALUES (p_business_id, '1000', 'Assets', 'ASSET', NULL, 'DEBIT', TRUE, 1000, 'Semua aset bisnis')
    RETURNING id INTO v_asset_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description)
    VALUES (p_business_id, '2000', 'Liabilities', 'LIABILITY', NULL, 'CREDIT', TRUE, 2000, 'Semua kewajiban bisnis')
    RETURNING id INTO v_liability_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description)
    VALUES (p_business_id, '3000', 'Equity', 'EQUITY', NULL, 'CREDIT', TRUE, 3000, 'Modal dan ekuitas pemilik')
    RETURNING id INTO v_equity_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description)
    VALUES (p_business_id, '4000', 'Revenue', 'REVENUE', NULL, 'CREDIT', TRUE, 4000, 'Semua pendapatan bisnis')
    RETURNING id INTO v_revenue_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description)
    VALUES (p_business_id, '5000', 'Expenses', 'EXPENSE', NULL, 'DEBIT', TRUE, 5000, 'Semua beban bisnis')
    RETURNING id INTO v_expense_id;

    INSERT INTO accounts (business_id, account_code, account_name, account_type, parent_account_id, normal_balance, is_system, sort_order, description, default_category) VALUES
    (p_business_id, '1100', 'Cash', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1100, 'Kas tunai', NULL),
    (p_business_id, '1200', 'Bank', 'ASSET', v_asset_id, 'DEBIT', TRUE, 1200, 'Rekening bank', NULL),
    (p_business_id, '1300', 'Fixed Assets', 'ASSET', v_asset_id, 'DEBIT', FALSE, 1300, 'Aset tetap / peralatan', 'CAPEX'),
    (p_business_id, '2100', 'Loans Payable', 'LIABILITY', v_liability_id, 'CREDIT', FALSE, 2100, 'Utang pinjaman', 'FIN'),
    (p_business_id, '3100', 'Owner''s Capital', 'EQUITY', v_equity_id, 'CREDIT', TRUE, 3100, 'Modal pemilik', 'FIN'),
    (p_business_id, '4100', 'Sales Revenue', 'REVENUE', v_revenue_id, 'CREDIT', TRUE, 4100, 'Pendapatan penjualan', 'EARN'),
    (p_business_id, '5100', 'Operating Expenses', 'EXPENSE', v_expense_id, 'DEBIT', TRUE, 5100, 'Beban operasional', 'OPEX'),
    (p_business_id, '5200', 'Variable Cost (COGS)', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5200, 'Biaya variabel / harga pokok penjualan', 'VAR'),
    (p_business_id, '5300', 'Tax Expenses', 'EXPENSE', v_expense_id, 'DEBIT', FALSE, 5300, 'Beban pajak', 'TAX');
END;
$$;

COMMENT ON FUNCTION create_default_accounts IS
  'Provision Chart of Accounts default untuk bisnis. Hanya creator atau manager bisnis yang boleh memanggil.';

-- ROLLBACK garis besar:
--   Restore versi sebelumnya dari migration 069 (use_invite_code 2-arg),
--   migration 004 (soft/restore), dan migration 013 (create_default_accounts).
--   Restore policy invite_codes SELECT (is_active = TRUE) dari schema.sql.
