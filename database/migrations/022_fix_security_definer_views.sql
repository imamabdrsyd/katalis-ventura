-- Migration 021: Fix SECURITY DEFINER views → SECURITY INVOKER
--
-- Masalah: View active_transactions, deleted_transactions, dan audit_trail_with_users
-- menggunakan SECURITY DEFINER (default PostgreSQL), sehingga RLS pada tabel yang
-- di-query dievaluasi menggunakan permission owner view (postgres/superuser),
-- bukan user yang sedang login. Ini menyebabkan RLS efektif di-bypass.
--
-- Fix: Recreate semua view dengan security_invoker = true agar RLS dievaluasi
-- berdasarkan user yang sedang query.
--
-- Catatan: Ini TIDAK mengubah user, role, atau data apapun. Hanya mengubah
-- cara view membaca data.

-- Fix 1: active_transactions
DROP VIEW IF EXISTS active_transactions;
CREATE VIEW active_transactions
WITH (security_invoker = true)
AS
SELECT * FROM transactions WHERE deleted_at IS NULL;

COMMENT ON VIEW active_transactions IS 'Transactions that are not soft-deleted';
GRANT SELECT ON active_transactions TO authenticated;

-- Fix 2: deleted_transactions
DROP VIEW IF EXISTS deleted_transactions;
CREATE VIEW deleted_transactions
WITH (security_invoker = true)
AS
SELECT
  t.*,
  p_deleted.full_name AS deleted_by_name
FROM transactions t
LEFT JOIN profiles p_deleted ON t.deleted_by = p_deleted.id
WHERE t.deleted_at IS NOT NULL
ORDER BY t.deleted_at DESC;

COMMENT ON VIEW deleted_transactions IS 'Soft-deleted transactions with user who deleted them';
GRANT SELECT ON deleted_transactions TO authenticated;

-- Fix 3: audit_trail_with_users
DROP VIEW IF EXISTS audit_trail_with_users;
CREATE VIEW audit_trail_with_users
WITH (security_invoker = true)
AS
SELECT
  al.*,
  p.full_name AS changed_by_name,
  p.avatar_url AS changed_by_avatar
FROM audit_log al
LEFT JOIN profiles p ON al.changed_by = p.id
ORDER BY al.changed_at DESC;

COMMENT ON VIEW audit_trail_with_users IS 'Audit log with user profile information';
GRANT SELECT ON audit_trail_with_users TO authenticated;
