-- Migration 086: Tabel junction invoice_transactions untuk fitur
-- "Buat Invoice dari Transaksi Piutang".
--
-- Tujuan: User bisa pilih 1+ transaksi piutang usaha (debit Piutang Usaha)
-- dan men-generate 1 invoice yang merangkumnya. Mendukung use case:
--   - 1 transaksi → 1 invoice (single)
--   - N transaksi → 1 invoice (multi-transaction billing untuk customer yang sama)
--
-- Kolom lama `invoices.transaction_id` tetap dipertahankan untuk backward
-- compatibility (data existing yang sudah pakai single-FK link).
-- Untuk invoice baru yang dibuat dari fitur ini, link disimpan di
-- tabel junction.
--
-- Constraint penting:
--   - UNIQUE(transaction_id): 1 transaksi hanya bisa di-link ke 1 invoice.
--     Mencegah double-billing (user create invoice dari transaksi yang sama 2x).
--   - ON DELETE CASCADE ke kedua sisi: kalau invoice/transaction di-hard-delete,
--     link auto-hapus. Catatan: transaksi pakai soft-delete (deleted_at), jadi
--     normal-flow tidak menyentuh CASCADE.

CREATE TABLE IF NOT EXISTS invoice_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  /* Snapshot amount saat link dibuat. Outstanding amount transaksi bisa
     berubah karena partial settlement, tapi line item invoice tetap
     mencerminkan kondisi saat invoice di-generate. */
  linked_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_transactions_invoice_id
  ON invoice_transactions(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_transactions_transaction_id
  ON invoice_transactions(transaction_id);

COMMENT ON TABLE invoice_transactions IS
  'Junction many-to-many antara invoices dan transactions. Dipakai oleh fitur "Buat Invoice dari Transaksi Piutang" — 1 invoice bisa merangkum N transaksi piutang dari customer yang sama.';

COMMENT ON COLUMN invoice_transactions.linked_amount IS
  'Snapshot outstanding amount transaksi saat invoice di-generate. Disimpan agar line item invoice stabil meskipun outstanding transaksi berubah karena partial settlement berikutnya.';

-- RLS: ikuti pola tabel invoice_line_items (akses inherit dari parent invoice)
ALTER TABLE invoice_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoice transaction links"
  ON invoice_transactions FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE business_id IN (SELECT get_my_business_ids())
    )
  );

CREATE POLICY "Managers can manage invoice transaction links"
  ON invoice_transactions FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE business_id IN (
        SELECT business_id FROM user_business_roles
        WHERE user_id = auth.uid() AND role IN ('business_manager', 'both')
      )
    )
  );

-- ROLLBACK:
--   DROP TABLE IF EXISTS invoice_transactions CASCADE;
