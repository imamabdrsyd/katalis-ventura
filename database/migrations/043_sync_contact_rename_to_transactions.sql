-- Migration 043: Sync contact rename ke transactions & invoices
-- Saat business_contacts.name diubah, otomatis propagate ke:
--   - transactions.name (case-insensitive match pada business yang sama)
--   - invoices.customer_name (case-insensitive match pada business yang sama)
--
-- Tujuan: menjaga konsistensi tampilan nama kontak di seluruh data historis
-- ketika user merename kontak dari halaman manajemen kontak.
--
-- Implementasi: AFTER UPDATE trigger pada business_contacts dengan filter
-- WHEN clause agar hanya fire saat kolom `name` benar-benar berubah.
--
-- SECURITY DEFINER digunakan agar trigger dapat menembus RLS pada
-- transactions/invoices — propagasi dianggap operasi sistem, bukan
-- edit manual oleh user. Filter business_id = NEW.business_id mencegah
-- cross-business tampering.

CREATE OR REPLACE FUNCTION sync_contact_name_to_transactions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update transactions.name untuk semua transaksi aktif yang nama-nya
  -- match (case-insensitive) dengan nama lama kontak.
  UPDATE transactions
     SET name = NEW.name
   WHERE business_id = NEW.business_id
     AND LOWER(name) = LOWER(OLD.name)
     AND deleted_at IS NULL;

  -- Update invoices.customer_name dengan logika yang sama.
  UPDATE invoices
     SET customer_name = NEW.name
   WHERE business_id = NEW.business_id
     AND LOWER(customer_name) = LOWER(OLD.name)
     AND deleted_at IS NULL;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_contact_name_to_transactions() IS
  'Trigger function: propagasi otomatis perubahan nama kontak ke transactions.name dan invoices.customer_name.';

-- Drop existing trigger jika ada (idempotent re-run)
DROP TRIGGER IF EXISTS trg_sync_contact_name_to_transactions ON business_contacts;

CREATE TRIGGER trg_sync_contact_name_to_transactions
  AFTER UPDATE OF name ON business_contacts
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION sync_contact_name_to_transactions();

COMMENT ON TRIGGER trg_sync_contact_name_to_transactions ON business_contacts IS
  'Auto-sync nama kontak ke transaksi & invoice terkait saat kontak di-rename.';
