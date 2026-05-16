-- Migration 077: RPC untuk agregat total CAPEX per bisnis.
--
-- Halaman Manage Business menampilkan "Business Capital" di tiap card,
-- yang = capital_investment + total CAPEX dari transaksi. Sebelumnya
-- halaman ini menarik SELURUH kolom `transactions` untuk semua bisnis
-- user lalu menghitung di browser (payload besar + parsing lambat).
--
-- RPC ini melakukan agregasi di Postgres dan hanya mengembalikan
-- satu baris (business_id, total_capex) per bisnis. SECURITY DEFINER
-- + filter ke `get_my_business_ids()` mencegah caller mengintip bisnis
-- yang bukan miliknya.
--
-- Definisi CAPEX selaras dengan calculations.ts:calculateTotalCapex:
--   1. category = 'CAPEX', ATAU
--   2. is_double_entry = true DAN debit_account adalah ASSET non-kas
--      (mengabaikan transaksi yang dihapus / soft-deleted)
--
-- Catatan: definisi ini sengaja tidak memperhitungkan multi-line
-- journal entries (journal_lines). Logika TS lama pun tidak — kalau
-- multi-line perlu masuk hitungan CAPEX di masa depan, update RPC ini
-- dan calculations.ts bersamaan.

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
      )
    )
  GROUP BY t.business_id;
$$;

GRANT EXECUTE ON FUNCTION get_capex_by_business() TO authenticated;

COMMENT ON FUNCTION get_capex_by_business() IS
  'Agregat total CAPEX per bisnis untuk halaman Manage Business. Hanya bisnis yang diakses caller (via get_my_business_ids).';
