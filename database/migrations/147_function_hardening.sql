-- 147_function_hardening.sql
--
-- Tiga pengerasan di lapisan function & grant. Semuanya BUKAN perubahan
-- perilaku aplikasi — sudah diverifikasi dulu bahwa role `anon` tidak pernah
-- dipakai: seluruh jalur publik (`app/[slug]`, `app/api/public/*`, `/api/stats`)
-- lewat `createAdminClient()` alias service_role, yang menembus RLS dan punya
-- grant sendiri.
--
-- Lint Supabase: 0011_function_search_path_mutable,
--                0028_anon_security_definer_function_executable

-- ---------------------------------------------------------------------------
-- 1. search_path yang dipatok
-- ---------------------------------------------------------------------------
-- Tanpa `SET search_path`, isi function diresolusi pakai search_path pemanggil.
-- Untuk function SECURITY DEFINER itu berbahaya: pemanggil bisa menaruh skema
-- tandingan di depan dan membajak nama tabel yang tidak di-kualifikasi. 13
-- function di bawah belum dipatok; 15 lainnya sudah `search_path=public` —
-- baris ini menyamakan sisanya dengan gaya yang sudah ada.

ALTER FUNCTION public.check_journal_lines_balance() SET search_path = public;
ALTER FUNCTION public.cleanup_expired_telegram_tokens() SET search_path = public;
ALTER FUNCTION public.cleanup_invoice_transactions_on_soft_delete() SET search_path = public;
ALTER FUNCTION public.generate_transaction_number(p_business_id uuid, p_year integer) SET search_path = public;
ALTER FUNCTION public.get_business_transaction_version(p_business_id uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.is_slug_available(p_slug text, p_exclude_business_id uuid) SET search_path = public;
ALTER FUNCTION public.log_audit_trail() SET search_path = public;
ALTER FUNCTION public.set_created_by() SET search_path = public;
ALTER FUNCTION public.set_transaction_number() SET search_path = public;
ALTER FUNCTION public.set_updated_by() SET search_path = public;
ALTER FUNCTION public.trigger_create_default_accounts() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- ---------------------------------------------------------------------------
-- 2. Cabut EXECUTE dari anon (dan dari PUBLIC)
-- ---------------------------------------------------------------------------
-- Postgres memberi EXECUTE ke PUBLIC secara default, dan Supabase menambah
-- grant eksplisit ke anon. Keduanya harus dicabut — mencabut dari `anon` saja
-- tidak berefek karena haknya masih menetes lewat PUBLIC.
--
-- Akibatnya 23 function SECURITY DEFINER berhenti bisa dipanggil tanpa login
-- lewat /rest/v1/rpc/ — termasuk `create_default_accounts`, `use_invite_code`,
-- dan `decrement_catalog_stock`.
--
-- Function milik extension (mis. btree_gist) DILEWATI: function penunjang
-- operator class dipanggil mesin index dan mencabut haknya bisa merusak query.

DO $$
DECLARE
  f          RECORD;
  sig        TEXT;
  n_trigger  INT := 0;
  n_biasa    INT := 0;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args,
           pg_get_function_result(p.oid) = 'trigger'  AS is_trigger
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    sig := format('public.%I(%s)', f.proname, f.args);

    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon;', sig);

    IF f.is_trigger THEN
      -- Function trigger dijalankan mesin trigger atas nama pemilik tabel.
      -- Tidak ada satu pun yang perlu dipanggil langsung lewat RPC.
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated;', sig);
      n_trigger := n_trigger + 1;
    ELSE
      -- Dikembalikan eksplisit supaya hak yang tadinya menetes lewat PUBLIC
      -- sekarang tercatat sebagai keputusan, bukan sisa default.
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', sig);
      n_biasa := n_biasa + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Grant function: % trigger dikunci, % function tetap terbuka untuk authenticated', n_trigger, n_biasa;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Tabel OCR: tegaskan "service_role saja"
-- ---------------------------------------------------------------------------
-- `ocr_scan_cache` dan `ocr_usage` punya RLS aktif tanpa satu pun policy. Itu
-- memang disengaja — keduanya hanya disentuh `src/lib/ocr/*` lewat
-- createAdminClient(). Tapi anon & authenticated masih memegang grant tabel
-- penuh; RLS jadi satu-satunya penahan. Mencabut grant membuat niatnya eksplisit
-- sekaligus menambah lapisan kedua kalau suatu hari ada yang menambah policy
-- permisif di sana.
--
-- Lint Supabase: 0008_rls_enabled_no_policy (INFO — deny-all yang disengaja)

REVOKE ALL ON TABLE public.ocr_scan_cache FROM anon, authenticated;
REVOKE ALL ON TABLE public.ocr_usage      FROM anon, authenticated;

COMMENT ON TABLE public.ocr_scan_cache IS
  'Cache hasil OCR, kunci SHA-256 file. Hanya service_role (src/lib/ocr/index.ts). RLS aktif tanpa policy = deny-all yang disengaja.';
COMMENT ON TABLE public.ocr_usage IS
  'Meteran kuota OCR per bisnis. Hanya service_role (src/lib/ocr/usage.ts). RLS aktif tanpa policy = deny-all yang disengaja.';
