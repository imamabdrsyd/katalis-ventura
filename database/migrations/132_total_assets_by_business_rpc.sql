-- Migration 132: RPC `get_total_assets_by_business()` — isi card "Business Capital"
-- di halaman Manage Business diselaraskan dengan labelnya.
--
-- MASALAH
-- Card berlabel "Business Capital" selama ini menampilkan
--   capital_investment + CAPEX  (via get_capex_by_business, migrasi 077 → 128).
-- CAPEX = belanja modal, khusus aset tetap. Itu konsep jauh lebih sempit
-- daripada "business capital"/modal usaha, yang mencakup modal kerja: kas,
-- piutang, DAN persediaan. Mismatch label vs isi sudah ada sejak migrasi 077;
-- migrasi 128 (yang benar sebagai perbaikan definisi CAPEX) hanya membuatnya
-- kelihatan — bisnis dagang yang seluruh modalnya berputar di persediaan
-- mendadak tampil Rp 0 walau asetnya ratusan juta.
--
-- PERBAIKAN
-- Card menampilkan TOTAL ASET: sisi penggunaan modal — kas + piutang +
-- persediaan + aset tetap neto. Angkanya wajib sama dengan baris "Total Aset"
-- di Neraca, jadi RPC ini meniru calculateBalanceSheet() (src/lib/calculations.ts)
-- pada tiap filternya:
--   * hanya transaksi posted & belum dihapus       → useReportData.ts:77
--   * jurnal penutup diabaikan                     → isClosingEntry, audit ACC-M3
--   * jurnal multi-baris dibaca dari journal_lines → migrasi 077/128 belum
--   * penyusutan garis lurus dikurangkan           → accounting/depreciation.ts
--   * capital_investment HANYA fallback saat bisnis belum punya satu pun
--     transaksi. Kalau sudah ada, modal awal otomatis dibukukan sebagai
--     transaksi "Modal Investasi Awal" (app/api/businesses/route.ts) —
--     menambahkannya lagi = double-count, persis guard `capitalAlreadyBooked`
--     di calculations.ts.
--
-- Total aset = Σ saldo akun ASSET (debit − kredit) − akumulasi penyusutan.
-- Identitas ini setara dengan `adjustedTotalAssets` di calculations.ts, karena
-- classifyAsset() di sana mempartisi seluruh nilai aset ke lancar + tetap:
--   totalCurrentAssets + (totalFixedAssets − akumulasi) = totalAssets − akumulasi.
-- Akun kontra-aset (mis. 1240 Accumulated Depreciation, normal_balance CREDIT)
-- ikut terhitung benar karena saldonya memang debit − kredit.
--
-- CATATAN: penyusutan dihitung dari metadata akun, bukan dari jurnal. Versi SQL
-- memakai CURRENT_DATE (zona waktu server) sedangkan versi TS memakai jam
-- browser — selisihnya maksimum satu bulan penyusutan, hanya tepat di
-- pergantian bulan.
--
-- `get_capex_by_business()` sengaja TIDAK di-drop: definisi CAPEX-nya benar dan
-- masih dipakai sebagai rujukan, hanya tidak lagi dipanggil UI.

CREATE OR REPLACE FUNCTION get_total_assets_by_business()
RETURNS TABLE (
  business_id UUID,
  total_assets NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH my_businesses AS (
    SELECT b.id, COALESCE(b.capital_investment, 0) AS capital_investment
    FROM businesses b
    WHERE b.id IN (SELECT get_my_business_ids())
  ),
  -- Populasi transaksi yang sama persis dengan yang dipakai Neraca
  posted AS (
    SELECT t.id, t.business_id, t.amount, t.debit_account_id, t.credit_account_id,
           COALESCE(t.is_multi_line, FALSE) AS is_multi_line
    FROM transactions t
    WHERE t.deleted_at IS NULL
      AND (t.status IS NULL OR t.status = 'posted')
      AND COALESCE(t.meta -> 'entry_type' ->> 'id', '') <> 'closing_entry'
      AND t.business_id IN (SELECT id FROM my_businesses)
  ),
  -- Mutasi aset dari transaksi dua-baris (debit_account_id / credit_account_id)
  single_moves AS (
    SELECT p.business_id, a.id AS account_id, p.amount AS delta
    FROM posted p
    JOIN accounts a ON a.id = p.debit_account_id
    WHERE NOT p.is_multi_line AND a.account_type = 'ASSET'
    UNION ALL
    SELECT p.business_id, a.id, -p.amount
    FROM posted p
    JOIN accounts a ON a.id = p.credit_account_id
    WHERE NOT p.is_multi_line AND a.account_type = 'ASSET'
  ),
  -- Mutasi aset dari jurnal multi-baris
  line_moves AS (
    SELECT p.business_id, a.id AS account_id,
           COALESCE(jl.debit_amount, 0) - COALESCE(jl.credit_amount, 0) AS delta
    FROM posted p
    JOIN journal_lines jl ON jl.transaction_id = p.id
    JOIN accounts a ON a.id = jl.account_id
    WHERE p.is_multi_line AND a.account_type = 'ASSET'
  ),
  balances AS (
    SELECT m.business_id, m.account_id, SUM(m.delta) AS saldo
    FROM (SELECT * FROM single_moves UNION ALL SELECT * FROM line_moves) m
    GROUP BY 1, 2
  ),
  gross AS (
    SELECT b.business_id, SUM(b.saldo) AS total
    FROM balances b
    GROUP BY 1
  ),
  -- Penyusutan garis lurus, mirror calculateStraightLineDepreciation():
  --   monthly        = max(0, cost − residu) / masa_manfaat
  --   monthsElapsed  = selisih bulan (tahun×12 + bulan) + 1  [bulan perolehan = bulan ke-1]
  --   effectiveMonths= clamp(monthsElapsed, 0, masa_manfaat)
  depreciation AS (
    SELECT bal.business_id,
           SUM(
             (GREATEST(0, bal.saldo - COALESCE(a.residual_value, 0)) / a.useful_life_months)
             * LEAST(
                 GREATEST(
                   0,
                   (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM a.acquisition_date)) * 12
                   + (EXTRACT(MONTH FROM CURRENT_DATE) - EXTRACT(MONTH FROM a.acquisition_date))
                   + 1
                 ),
                 a.useful_life_months
               )
           ) AS akumulasi
    FROM balances bal
    JOIN accounts a ON a.id = bal.account_id
    WHERE a.account_type = 'ASSET'
      AND a.default_category = 'CAPEX'
      AND a.is_active
      AND COALESCE(a.useful_life_months, 0) > 0
      AND a.acquisition_date IS NOT NULL
      AND bal.saldo > 0
    GROUP BY 1
  ),
  trx_count AS (
    SELECT p.business_id, COUNT(*) AS n
    FROM posted p
    GROUP BY 1
  )
  SELECT
    mb.id,
    CASE
      WHEN COALESCE(tc.n, 0) = 0 THEN mb.capital_investment
      ELSE COALESCE(g.total, 0) - COALESCE(d.akumulasi, 0)
    END AS total_assets
  FROM my_businesses mb
  LEFT JOIN gross g ON g.business_id = mb.id
  LEFT JOIN depreciation d ON d.business_id = mb.id
  LEFT JOIN trx_count tc ON tc.business_id = mb.id;
$$;

GRANT EXECUTE ON FUNCTION get_total_assets_by_business() TO authenticated;

COMMENT ON FUNCTION get_total_assets_by_business() IS
  'Total aset per bisnis untuk card "Business Capital" di Manage Business. '
  'Kas + piutang + persediaan + aset tetap neto, mirror calculateBalanceSheet() '
  'termasuk journal_lines, jurnal penutup, dan penyusutan (migrasi 132). '
  'capital_investment hanya dipakai bila bisnis belum punya transaksi.';
