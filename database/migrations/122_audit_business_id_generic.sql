-- Migration 122: audit_log.metadata.business_id untuk SEMUA tabel ber-business_id
--
-- Bug: `log_audit_trail()` (migr 004) meng-hardcode daftar tabel saat mengambil
-- business_id (transactions/businesses/accounts/investor_metrics). Tabel yang
-- ditambahkan belakangan — `catalog_items` (migr 099), `bookings`,
-- `business_units`, dll — jatuh ke ELSE tanpa cabang, sehingga
-- `metadata.business_id` selalu NULL. Akibat nyata: panel Riwayat Stok kosong
-- karena memfilter `metadata->>business_id`, padahal 32 baris audit ada.
--
-- Fix: ambil business_id secara GENERIK dari snapshot row (to_jsonb), dengan
-- pengecualian tabel `businesses` yang business_id-nya = id-nya sendiri.
-- Tabel tanpa kolom business_id tetap NULL (perilaku lama, tidak regresi).

CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
  business_id_value UUID;
  new_data JSONB;
  old_data JSONB;
BEGIN
  new_data := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  old_data := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;

  IF TG_TABLE_NAME = 'businesses' THEN
    -- business_id bisnis = id-nya sendiri
    business_id_value := COALESCE(new_data->>'id', old_data->>'id')::UUID;
  ELSE
    -- Generik: berlaku untuk transactions, accounts, investor_metrics,
    -- catalog_items, bookings, business_units, dan tabel ber-business_id lain.
    business_id_value := COALESCE(new_data->>'business_id', old_data->>'business_id')::UUID;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values, changed_by, metadata)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', NULL, new_data, auth.uid(),
            jsonb_build_object('business_id', business_id_value));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD IS DISTINCT FROM NEW THEN
      INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values, changed_by, metadata)
      VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', old_data, new_data, auth.uid(),
              jsonb_build_object('business_id', business_id_value));
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values, changed_by, metadata)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', old_data, NULL, auth.uid(),
            jsonb_build_object('business_id', business_id_value));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill baris audit lama yang business_id-nya NULL, diambil dari snapshot
-- row yang sudah tersimpan di old_values/new_values.
UPDATE audit_log
SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{business_id}',
      to_jsonb(COALESCE(new_values->>'business_id', old_values->>'business_id'))
    )
WHERE (metadata->>'business_id') IS NULL
  AND table_name <> 'businesses'
  AND COALESCE(new_values->>'business_id', old_values->>'business_id') IS NOT NULL;
