-- 149_businesses_tenant_isolation.sql
--
-- LUBANG 3 — seluruh isi tabel `businesses` terbuka untuk tiap user yang login
--
-- Dua policy SELECT selimut membatalkan `businesses_read` (anggota ATAU
-- pembuat):
--
--   "Authenticated users can view all businesses"  TO authenticated  USING (true)
--   "Anyone can view active businesses"            TO public         USING (is_archived = false)
--
-- Karena policy permisif di-OR, keduanya membuat setiap baris terlihat oleh
-- siapa pun yang punya sesi. Diukur langsung: seorang manager yang berhak atas
-- 2 bisnis ternyata membaca semua 15.
--
-- Yang ikut terbawa bukan cuma nama bisnis. `select('*')` mengembalikan seluruh
-- kolom, termasuk:
--   * ical_feed_token   — token feed .ics; pemegangnya bisa berlangganan
--                         kalender booking bisnis mana pun
--   * qris_image_url    — QRIS statis untuk pembayaran POS
--   * property_address, registered_address, legal_name, invoice_settings
--
-- Policy ini ada untuk menopang daftar pilihan di /join-business. Kebutuhan itu
-- kini dilayani GET /api/businesses/discoverable lewat admin client, yang hanya
-- mengembalikan id, business_name, logo_url, dan capital_investment. (Kolom
-- modal sengaja dipertahankan: kartu pilihan memang menampilkan "Modal: Rp …"
-- untuk calon investor.)
--
-- Menyempitkan select() di sisi klien saja tidak cukup — RLS tidak bisa
-- membatasi kolom, dan PostgREST melayani `select=*` dari siapa pun yang punya
-- anon key. Penyaringannya harus pindah ke server, lalu policy selimutnya
-- dicabut di sini.
--
-- Lint Supabase: 0006_multiple_permissive_policies

DROP POLICY IF EXISTS "Authenticated users can view all businesses" ON public.businesses;
DROP POLICY IF EXISTS "Anyone can view active businesses"           ON public.businesses;

-- Tersisa untuk SELECT: businesses_read — EXISTS(anggota) OR created_by = uid.
-- Itu persis yang dibutuhkan BusinessContext, yang memang selalu memfilter
-- eksplisit (.eq('created_by', …) dan .in('id', allBusinessIds)).

COMMENT ON TABLE public.businesses IS
  'Entitas bisnis. SELECT dibatasi anggota atau pembuat (businesses_read). Daftar untuk /join-business TIDAK boleh lewat tabel ini — pakai GET /api/businesses/discoverable (admin client, kolom terbatas), karena baris ini memuat ical_feed_token & qris_image_url.';
