-- Migration 089: Cegah self-promotion ke superadmin via profiles.default_role
--
-- Masalah:
--   RLS `profiles_update_self` & `profiles_insert_self` hanya cek
--   `id = auth.uid()` tanpa membatasi nilai `default_role`. Setiap user
--   bisa menjalankan
--     UPDATE profiles SET default_role = 'superadmin' WHERE id = auth.uid();
--   lewat klien Supabase dan mendapat superadmin sepihak.
--
--   Privilege itu dijadikan otoritas oleh banyak path:
--     - app/api/transactions/[id]/route.ts (bypass posted-lock & period-lock)
--     - app/api/businesses/[id]/hard-delete (gating hard-delete)
--     - app/api/business-join-requests/[id]/approve (role hasil approve
--       dibaca dari profile requester)
--     - migration 072_merge_both_superadmin (use_invite_code memberi
--       superadmin saat redeemer punya default_role superadmin)
--
-- Fix:
--   Trigger BEFORE INSERT OR UPDATE pada profiles yang menolak upaya
--   menaikkan default_role ke 'superadmin' kecuali caller (auth.uid())
--   sudah memiliki default_role 'superadmin'. Operasi service role /
--   migrasi (auth.uid() IS NULL) tetap diizinkan supaya seed admin
--   awal dan tooling internal tidak ikut terblokir.

CREATE OR REPLACE FUNCTION prevent_default_role_self_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF NEW.default_role IS DISTINCT FROM 'superadmin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.default_role = 'superadmin' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT default_role INTO v_caller_role
  FROM profiles
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Tidak berhak mengubah default_role menjadi superadmin'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION prevent_default_role_self_promotion IS
  'Cegah user terautentikasi mempromosikan diri ke superadmin via profiles.default_role. Membypass migrasi & service role (auth.uid IS NULL).';

DROP TRIGGER IF EXISTS prevent_profile_role_escalation ON profiles;
CREATE TRIGGER prevent_profile_role_escalation
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_default_role_self_promotion();

-- Diagnostic query (RUN MANUALLY untuk audit):
--   Akun yang sempat self-promote di luar admin awal (imam.isyida@gmail.com).
--   Tinjau lalu turunkan default_role-nya manual jika bukan superadmin sah.
--
-- SELECT p.id, u.email, p.default_role, p.updated_at
-- FROM profiles p
-- JOIN auth.users u ON u.id = p.id
-- WHERE p.default_role = 'superadmin'
--   AND u.email <> 'imam.isyida@gmail.com'
-- ORDER BY p.updated_at DESC;

-- ROLLBACK:
--   DROP TRIGGER IF EXISTS prevent_profile_role_escalation ON profiles;
--   DROP FUNCTION IF EXISTS prevent_default_role_self_promotion();
