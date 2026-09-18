-- 150_fix_creator_claim_recursion.sql
--
-- REGRESI dari migrasi 148. Policy "Creator can claim own business" menguji
-- kepemilikan lewat subquery langsung ke `businesses`:
--
--     EXISTS (SELECT 1 FROM businesses b
--             WHERE b.id = business_id AND b.created_by = (select auth.uid()))
--
-- Subquery itu sendiri tunduk pada RLS `businesses`, dan policy `businesses_read`
-- berbunyi "EXISTS(... FROM user_business_roles ...) OR created_by = uid".
-- Jadi: policy user_business_roles → businesses → user_business_roles → ...
--
--     ERROR: infinite recursion detected in policy for relation "user_business_roles"
--
-- Akibatnya POST /api/businesses gagal 500 — pembuatan bisnis baru patah total.
-- Tidak tertangkap saat verifikasi migrasi 148 karena ekspresinya diuji sebagai
-- query biasa; di luar konteks evaluasi policy, rekursinya memang tidak terpicu.
--
-- Perbaikannya sama dengan yang sudah dipakai repo ini untuk masalah serupa
-- (Issue #11 di docs: get_my_business_ids / is_business_manager): pindahkan
-- pengujian ke function SECURITY DEFINER, yang menembus RLS sehingga rantainya
-- terputus.

CREATE OR REPLACE FUNCTION public.is_business_creator(bid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM businesses
    WHERE id = bid AND created_by = auth.uid()
  );
$$;

-- Ikut konvensi migrasi 147: cabut dari PUBLIC/anon, buka hanya untuk authenticated.
REVOKE ALL ON FUNCTION public.is_business_creator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_creator(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_business_creator(uuid) IS
  'SECURITY DEFINER: apakah auth.uid() pembuat bisnis ini. Wajib SECURITY DEFINER — dipakai di policy user_business_roles, dan subquery biasa ke businesses akan memicu rekursi lewat businesses_read.';

DROP POLICY IF EXISTS "Creator can claim own business" ON public.user_business_roles;

CREATE POLICY "Creator can claim own business" ON public.user_business_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND public.is_business_creator(business_id)
  );
