-- ============================================================
-- 084_journal_lines_account_fk_restrict.sql
-- Tambah ON DELETE RESTRICT pada FK journal_lines.account_id.
--
-- Sebelumnya: REFERENCES accounts(id) tanpa ON DELETE rule
-- → default PostgreSQL (NO ACTION) memang cegah delete, tapi
--   error message tidak eksplisit dan tidak terdokumentasi.
--
-- ON DELETE RESTRICT:
-- → Mencegah hapus akun yang masih dipakai di journal_lines,
--   dengan error yang jelas. Lebih aman untuk data integrity
--   karena account_id adalah NOT NULL (SET NULL tidak applicable).
-- ============================================================

ALTER TABLE journal_lines
  DROP CONSTRAINT IF EXISTS journal_lines_account_id_fkey;

ALTER TABLE journal_lines
  ADD CONSTRAINT journal_lines_account_id_fkey
  FOREIGN KEY (account_id)
  REFERENCES accounts(id)
  ON DELETE RESTRICT;
