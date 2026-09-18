-- 148_rls_close_privilege_escalation.sql
--
-- Menutup dua lubang eskalasi hak di lapisan RLS, sekaligus membuang policy
-- warisan yang menumpuk. Keduanya ditemukan saat menelusuri lint
-- `multiple_permissive_policies` — 94 kombinasi tumpang tindih ternyata bukan
-- cuma soal kecepatan, tapi menyembunyikan dua policy tangkap-semua.
--
-- Lint Supabase: 0006_multiple_permissive_policies
--
-- ===========================================================================
-- LUBANG 1 — investor bisa MENULIS transaksi
-- ===========================================================================
-- `transactions` punya empat policy permisif. Tiga di antaranya menyusun RBAC
-- dengan rapi (investor SELECT saja, manager penuh). Yang keempat,
-- "Users can manage transactions" (FOR ALL), hanya menguji keanggotaan:
--
--     business_id IN (SELECT business_id FROM user_business_roles
--                     WHERE user_id = auth.uid())
--
-- Tanpa filter role. Karena policy permisif di-OR, satu baris itu membatalkan
-- ketiga policy lain: pemegang session investor bisa PATCH/DELETE langsung ke
-- /rest/v1/transactions. Dikonfirmasi lewat EXPLAIN sebagai investor murni —
-- rencana UPDATE lolos tanpa `One-Time Filter: false`.
--
-- UI dan route handler memang menahan investor, tapi RLS adalah lapisan
-- terakhir dan di sini ia bocor.
--
-- Aman dicabut: peran 'both' TIDAK BISA ada (CHECK constraint di
-- user_business_roles cuma mengizinkan business_manager/investor/superadmin,
-- dan src/lib/roles.ts memetakan legacy 'both' → 'superadmin'), jadi ketiga
-- policy tersisa sudah mencakup semua pemegang peran yang mungkin.

DROP POLICY IF EXISTS "Users can manage transactions" ON public.transactions;

-- ===========================================================================
-- LUBANG 2 — siapa pun bisa mengangkat diri jadi superadmin bisnis mana pun
-- ===========================================================================
-- `user_business_roles` punya dua policy INSERT yang syaratnya hanya
-- `user_id = auth.uid()` — tanpa batasan business_id, tanpa batasan role.
-- Artinya user terdaftar mana pun bisa menyisipkan
--
--     { user_id: <dirinya>, business_id: <bisnis siapa pun>, role: 'superadmin' }
--
-- lewat PostgREST dan langsung memegang bisnis itu. Tidak ada trigger penjaga:
-- `prevent_default_role_self_promotion` hanya menempel di profiles.default_role,
-- sedangkan otoritas yang sesungguhnya ada di kolom ini.
--
-- Jalur bergabung yang SAH tidak membutuhkan policy itu:
--   * kode undangan  → use_invite_code() SECURITY DEFINER, menembus RLS, dan
--                      rolenya diambil dari kode undangan, bukan input user
--   * diundang manager → policy "Business managers can insert roles"
--   * buat bisnis baru → ditangani policy pengganti di bawah

DROP POLICY IF EXISTS "Users can join businesses"  ON public.user_business_roles;
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_business_roles;

-- Satu-satunya self-insert yang sah: mengklaim bisnis yang baru kita buat
-- sendiri (dipakai POST /api/businesses, yang memakai session user). Dibatasi
-- ke bisnis dengan created_by = kita, sehingga "gabung ke bisnis sembarang"
-- tertutup.
CREATE POLICY "Creator can claim own business" ON public.user_business_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
        AND b.created_by = (select auth.uid())
    )
  );

-- ===========================================================================
-- Policy kembar — dibuang karena benar-benar redundan
-- ===========================================================================
-- Semua yang dicabut di bawah ini ekspresinya identik, atau merupakan himpunan
-- bagian murni dari policy yang tetap dipertahankan. Tidak ada perubahan siapa
-- boleh apa; yang hilang hanya cabang OR yang harus dievaluasi Postgres setiap
-- query.

-- profiles: "profiles_read_public" identik dengan "Users can view all profiles"
--           (dua-duanya USING (true)); dua lainnya kembar persis juga.
DROP POLICY IF EXISTS "profiles_read_public"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_self"  ON public.profiles;  -- = "Users can insert own profile"
DROP POLICY IF EXISTS "profiles_update_self"  ON public.profiles;  -- = "Users can update own profile"

-- businesses: "businesses_read" sudah persis gabungan dua policy SELECT lain
--             (EXISTS(anggota) OR created_by = uid).
DROP POLICY IF EXISTS "Users can view own businesses"   ON public.businesses;
DROP POLICY IF EXISTS "Users can view their businesses" ON public.businesses;
-- ketiganya menguji created_by = uid
DROP POLICY IF EXISTS "Business creators can update"    ON public.businesses;
DROP POLICY IF EXISTS "Users can update own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can create businesses"     ON public.businesses;  -- = businesses_insert

-- user_business_roles: baris sendiri selalu tercakup "roles in their businesses"
--                      (bisnis tempat kita punya peran pasti memuat baris kita).
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_business_roles;
