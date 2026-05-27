-- Migration 087: Fix RLS policy invoice_transactions agar INSERT lolos.
--
-- Masalah:
--   Policy `FOR ALL` di migration 086 hanya punya `USING` clause. Di Postgres,
--   `FOR ALL` policy butuh `WITH CHECK` untuk operasi INSERT/UPDATE — tanpa itu,
--   `USING` saja tidak dipakai untuk validasi row baru sehingga INSERT default
--   deny ("new row violates row-level security policy").
--
-- Solusi:
--   Drop policy lama, recreate dengan pola yang konsisten dengan invoice_line_items
--   (migration 072) — pakai helper `is_business_manager(business_id)` dan
--   sertakan `WITH CHECK` clause.

DROP POLICY IF EXISTS "Managers can manage invoice transaction links"
  ON invoice_transactions;

CREATE POLICY "Managers can manage invoice transaction links"
  ON invoice_transactions FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE is_business_manager(business_id)
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE is_business_manager(business_id)
    )
  );

-- ROLLBACK:
--   DROP POLICY IF EXISTS "Managers can manage invoice transaction links"
--     ON invoice_transactions;
--   CREATE POLICY "Managers can manage invoice transaction links"
--     ON invoice_transactions FOR ALL
--     USING (
--       invoice_id IN (
--         SELECT id FROM invoices
--         WHERE business_id IN (
--           SELECT business_id FROM user_business_roles
--           WHERE user_id = auth.uid() AND role IN ('business_manager', 'both')
--         )
--       )
--     );
