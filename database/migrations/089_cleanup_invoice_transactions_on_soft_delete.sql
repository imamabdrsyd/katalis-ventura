-- Migration 089: Trigger untuk auto-hapus invoice_transactions saat invoice
-- di-SOFT-DELETE, sebagai pertahanan database-level.
--
-- Latar belakang:
--   invoice_transactions.transaction_id punya UNIQUE constraint untuk
--   mencegah 1 transaksi di-link ke >1 invoice (anti double-billing).
--
--   Tapi invoice dihapus secara SOFT (UPDATE deleted_at), yang TIDAK memicu
--   ON DELETE CASCADE. Akibatnya junction row tetap ada dan UNIQUE constraint
--   memblokir pembuatan invoice baru dari transaksi yang sama — padahal
--   invoice lamanya sudah "dihapus" dari sudut pandang user.
--
--   Kode aplikasi (deleteInvoice) sudah menghapus junction rows sebelum soft
--   delete, tapi trigger ini menjamin konsistensi untuk SEMUA jalur soft
--   delete (raw SQL, admin tool, jalur kode lain di masa depan).
--
-- Catatan: partial unique index tidak bisa dipakai di sini karena kondisi
-- "invoice aktif" ada di tabel lain (invoices.deleted_at), sedangkan partial
-- index hanya boleh memfilter kolom tabelnya sendiri.

CREATE OR REPLACE FUNCTION cleanup_invoice_transactions_on_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Hanya saat transisi dari aktif → soft-deleted
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM invoice_transactions WHERE invoice_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_invoice_transactions_on_soft_delete ON invoices;

CREATE TRIGGER trg_cleanup_invoice_transactions_on_soft_delete
  AFTER UPDATE OF deleted_at ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_invoice_transactions_on_soft_delete();

-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_cleanup_invoice_transactions_on_soft_delete ON invoices;
--   DROP FUNCTION IF EXISTS cleanup_invoice_transactions_on_soft_delete();
