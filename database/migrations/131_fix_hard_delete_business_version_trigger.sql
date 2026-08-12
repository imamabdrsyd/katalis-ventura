-- Migration 131: Fix hard delete bisnis gagal karena trigger versioning
--
-- MASALAH
-- `DELETE FROM businesses` men-cascade ke `transactions`. Setiap baris transaksi
-- yang terhapus memicu trigger AFTER DELETE `trg_bump_transaction_version`, yang
-- meng-upsert baris ke `business_transaction_versions`. Pada titik itu baris
-- `businesses` sudah hilang, sehingga insert-nya melanggar FK:
--
--   ERROR 23503: insert or update on table "business_transaction_versions"
--   violates foreign key constraint "business_transaction_versions_business_id_fkey"
--
-- Akibatnya seluruh transaksi hard delete di-rollback — bisnis yang punya
-- transaksi tidak pernah bisa dihapus permanen.
--
-- PERBAIKAN
-- Saat operasi DELETE, lewati bump version bila baris `businesses` sudah tidak
-- ada (artinya kita sedang berada di dalam cascade penghapusan bisnis). Tidak
-- ada gunanya menaikkan cache version untuk bisnis yang sudah dihapus — baris
-- `business_transaction_versions` & `financial_summary_cache` miliknya juga ikut
-- ter-cascade. Perilaku INSERT/UPDATE tidak berubah.

CREATE OR REPLACE FUNCTION bump_business_transaction_version()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  v_business_id := COALESCE(NEW.business_id, OLD.business_id);

  IF v_business_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Cascade dari penghapusan bisnis: parent sudah hilang, jangan tulis apa pun.
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM businesses WHERE id = v_business_id) THEN
    RETURN OLD;
  END IF;

  -- Upsert version counter
  INSERT INTO business_transaction_versions (business_id, transaction_version, updated_at)
  VALUES (v_business_id, 1, now())
  ON CONFLICT (business_id) DO UPDATE
    SET transaction_version = business_transaction_versions.transaction_version + 1,
        updated_at = now();

  -- Tandai semua cache bisnis ini sebagai stale
  UPDATE financial_summary_cache
    SET is_stale = TRUE
    WHERE business_id = v_business_id
      AND is_stale = FALSE;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
