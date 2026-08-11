-- Migration 128: Perbaiki `get_capex_by_business()` — persediaan & piutang
-- tidak lagi dihitung sebagai belanja modal. (Temuan audit ACC-M12,
-- `docs/AUDIT_2026-06-11.md`.)
--
-- MASALAH
-- Migrasi 077 mendefinisikan CAPEX sebagai "debit_account bertipe ASSET dan
-- bukan kas". Predikat itu terlalu luas: SEMUA aset non-kas ikut terjaring,
-- termasuk dua yang jelas bukan belanja modal —
--   * Persediaan  (pembelian stok, kategori VAR — masih jadi aset lancar,
--                  nantinya jadi HPP saat terjual, bukan aset tetap)
--   * Piutang     (penjualan kredit & talangan — hak tagih, bukan aset
--                  yang dibeli)
-- Akibatnya "Business Capital" di card halaman Manage Business overstated,
-- dan makin melenceng untuk bisnis dagang yang sering restock.
--
-- PERBAIKAN
-- Tambah dua pengecualian yang MENIRU heuristik TypeScript agar klasifikasi
-- di server dan di browser tidak bercerita beda:
--   * isInventoryAccount()     — src/lib/utils/inventoryHelper.ts
--   * isAnyReceivableAccount() — src/lib/accounting/classification.ts
--     (= isTradeReceivableAccount OR isAdvanceReceivableAccount)
-- Keduanya flag-first lalu fallback ke default_category + pola nama akun,
-- persis seperti versi TS-nya.
--
-- Sisa definisi tidak berubah: category='CAPEX' tetap lolos apa adanya,
-- soft-deleted tetap dibuang, multi-line (journal_lines) tetap di luar
-- cakupan seperti catatan migrasi 077.

CREATE OR REPLACE FUNCTION get_capex_by_business()
RETURNS TABLE (
  business_id UUID,
  total_capex NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    t.business_id,
    COALESCE(SUM(t.amount), 0) AS total_capex
  FROM transactions t
  LEFT JOIN accounts a ON a.id = t.debit_account_id
  WHERE t.deleted_at IS NULL
    AND t.business_id IN (SELECT get_my_business_ids())
    AND (
      t.category = 'CAPEX'
      OR (
        t.is_double_entry = TRUE
        AND a.account_type = 'ASSET'
        AND COALESCE(a.is_cash_equivalent, FALSE) = FALSE

        -- Bukan persediaan (mirror isInventoryAccount)
        AND COALESCE(a.default_category, '') <> 'VAR'
        AND a.account_name !~* 'persediaan|inventory|stok|barang|bahan'

        -- Bukan piutang usaha / talangan (mirror isAnyReceivableAccount).
        -- default_category 'EARN' → piutang usaha, 'FIN' → piutang talangan.
        AND COALESCE(a.is_trade_receivable, FALSE) = FALSE
        AND COALESCE(a.default_category, '') NOT IN ('EARN', 'FIN')
        AND a.account_name !~* 'piutang usaha|piutang dagang|piutang pelanggan|trade receivable|account receivable|accounts receivable|talangan|advance'
      )
    )
  GROUP BY t.business_id;
$$;

GRANT EXECUTE ON FUNCTION get_capex_by_business() TO authenticated;

COMMENT ON FUNCTION get_capex_by_business() IS
  'Agregat CAPEX per bisnis untuk card Manage Business. CAPEX = kategori CAPEX '
  'atau debit ke ASSET non-kas yang bukan persediaan & bukan piutang (migr 128, '
  'audit ACC-M12). Multi-line journal entries di luar cakupan.';
