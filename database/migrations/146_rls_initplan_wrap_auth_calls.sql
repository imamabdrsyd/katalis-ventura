-- 146_rls_initplan_wrap_auth_calls.sql
--
-- Masalah: 72 policy RLS memanggil auth.uid() / auth.jwt() / auth.role() secara
-- telanjang. Postgres memperlakukan panggilan itu sebagai VOLATILE sehingga
-- dievaluasi ULANG UNTUK SETIAP BARIS yang dipindai. Di tabel panas seperti
-- `transactions` dan `journal_lines` itu berarti ribuan pemanggilan per query.
--
-- Perbaikan: bungkus jadi `(select auth.uid())`. Subquery skalar tanpa korelasi
-- di-hoist planner jadi InitPlan — dievaluasi SEKALI per query, hasilnya dipakai
-- ulang. Semantiknya identik; ini murni soal titik evaluasi.
--
-- Lint Supabase: 0003_auth_rls_initplan
--
-- Ditulis sebagai loop, bukan 72 ALTER POLICY literal, supaya idempoten dan
-- tetap benar kalau ada policy baru yang lolos dengan pola lama.

DO $$
DECLARE
  p            RECORD;
  new_qual     TEXT;
  new_check    TEXT;
  stmt         TEXT;
  n_fixed      INT := 0;
BEGIN
  FOR p IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ( (qual       ~ 'auth\.(uid|jwt|role)\(\)' AND qual       !~ '\(\s*SELECT\s+auth\.')
         OR (with_check ~ 'auth\.(uid|jwt|role)\(\)' AND with_check !~ '\(\s*SELECT\s+auth\.') )
  LOOP
    -- Lookbehind `(?<!SELECT )` mencegah pembungkusan ganda pada policy yang
    -- sebagiannya sudah benar.
    new_qual  := regexp_replace(p.qual,       '(?<!SELECT )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');
    new_check := regexp_replace(p.with_check, '(?<!SELECT )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');

    -- ALTER POLICY mempertahankan nama, role, dan command; hanya ekspresinya
    -- yang ditukar. USING tidak ada untuk INSERT, WITH CHECK tidak ada untuk
    -- SELECT/DELETE — jadi klausanya dirakit kondisional.
    stmt := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename)
         || coalesce(' USING (' || new_qual || ')', '')
         || coalesce(' WITH CHECK (' || new_check || ')', '');

    EXECUTE stmt;
    n_fixed := n_fixed + 1;
  END LOOP;

  RAISE NOTICE 'RLS initplan: % policy dibungkus ulang', n_fixed;
END $$;
