-- Migration 151: Site CMS — konten halaman publik dikelola platform admin
--
-- Konteks:
--   Landing page (`app/page.tsx`), metadata SEO (`app/layout.tsx`), dan halaman
--   legal (`/privacy`, `/terms`) semuanya hardcode di kode. Mengganti satu
--   kalimat = commit + deploy. Migrasi ini memindahkan ISI-nya ke DB supaya
--   platform admin bisa menyuntingnya dari `/admin`, sementara layout, animasi,
--   dan komponen interaktif tetap di kode (pola "section slot", bukan page
--   builder bebas).
--
-- Dua otoritas yang SENGAJA dipisah:
--   1. `is_business_manager(bid)` — otoritas per-bisnis (sudah ada).
--   2. `is_platform_admin()`     — otoritas tingkat platform (BARU di sini).
--
--   Migrasi 072 sengaja mencabut semua policy superadmin global sehingga
--   superadmin kini membership-scoped: dia berkuasa di bisnis yang dia ikuti,
--   BUKAN di seluruh platform. Konten axionventura.com bukan milik bisnis mana
--   pun, jadi butuh gerbang tingkat platform tersendiri. Jangan gabungkan
--   kembali keduanya — `is_business_manager` yang ikut memberi akses CMS akan
--   membuat setiap manager bisnis bisa mengubah landing page.
--
--   Gerbangnya aman dipakai karena migrasi 089 memasang trigger
--   `prevent_default_role_self_promotion` yang menolak user menaikkan
--   `profiles.default_role` ke 'superadmin' sendiri.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Gerbang otoritas tingkat platform
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND default_role = 'superadmin'
  );
$$;

COMMENT ON FUNCTION is_platform_admin IS
  'Otoritas tingkat PLATFORM (konten situs publik), berbeda dari is_business_manager yang per-bisnis. Sengaja dibaca dari profiles.default_role yang dijaga trigger prevent_default_role_self_promotion (migrasi 089).';

-- Postgres memberi EXECUTE ke PUBLIC untuk setiap fungsi baru, sehingga tanpa
-- REVOKE fungsi ini terekspos di /rest/v1/rpc bagi pengunjung tanpa sesi.
-- Nilainya memang selalu false untuk anon (auth.uid() NULL) jadi tidak ada
-- kebocoran data, tapi permukaan RPC-nya tidak perlu dibuka — is_business_manager()
-- sudah dicabut dengan cara yang sama.
REVOKE EXECUTE ON FUNCTION is_platform_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_platform_admin() FROM anon;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. site_pages — satu baris per halaman, draft & published terpisah
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Kontennya disimpan sebagai SATU dokumen JSONB per halaman, bukan satu baris
-- per section. Alasannya: penyuntingan selalu menyentuh halaman secara utuh,
-- sehingga draft → publish jadi atomik (satu UPDATE) dan rollback cuma perlu
-- menyalin balik satu nilai. Urutan section hidup di dalam dokumen itu.
--
-- `published_content` NULL = halaman belum pernah dipublikasikan; renderer
-- jatuh ke default yang ada di kode (src/lib/site/*Defaults.ts), jadi halaman
-- publik tidak pernah blank walau tabel ini kosong.

CREATE TABLE IF NOT EXISTS site_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL UNIQUE
    CHECK (page_key IN ('landing', 'seo', 'privacy', 'terms', 'blog_index', 'market_insights')),
  draft_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_content JSONB,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE site_pages IS
  'Konten halaman publik yang dikelola platform admin. Satu baris per halaman; draft_content disunting, published_content yang dibaca publik.';
COMMENT ON COLUMN site_pages.published_content IS
  'NULL = belum pernah dipublikasikan. Renderer memakai default di kode, lalu di-merge dengan nilai ini (array replace, object merge) sehingga key yang hilang tetap punya fallback.';

DROP TRIGGER IF EXISTS update_site_pages_updated_at ON site_pages;
CREATE TRIGGER update_site_pages_updated_at
  BEFORE UPDATE ON site_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. site_page_versions — riwayat setiap publikasi, untuk rollback
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Diisi saat publish (snapshot dari isi yang baru ditayangkan). Tidak pernah
-- di-UPDATE — hanya INSERT dan (kelak) pembersihan versi lama.

CREATE TABLE IF NOT EXISTS site_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL,
  content JSONB NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_site_page_versions_page_key
  ON site_page_versions (page_key, created_at DESC);

COMMENT ON TABLE site_page_versions IS
  'Snapshot tiap publikasi halaman publik. Append-only; dipakai untuk rollback dari /admin.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. site_posts — artikel /blog & /market-insights
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Artikel yang sudah ada tetap hidup di kode (`src/lib/blog/posts.ts` +
-- `app/blog/<slug>/page.tsx`) karena body-nya JSX bespoke 400+ baris yang
-- sudah terindeks Google; menyandikannya ulang ke blok berisiko menurunkan
-- kualitas halaman yang sudah jalan. Indeks blog MENGGABUNGKAN artikel kode
-- dan artikel tabel ini. Artikel baru dibuat di sini.
--
-- `body` = array blok terstruktur (heading/paragraph/list/callout/table/...),
-- bukan HTML mentah, supaya rendering tetap memakai komponen desain sendiri
-- dan tidak ada jalur injeksi HTML dari form admin.

CREATE TABLE IF NOT EXISTS site_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection TEXT NOT NULL CHECK (collection IN ('blog', 'market_insights')),
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  cover_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (collection, slug)
);

CREATE INDEX IF NOT EXISTS idx_site_posts_published
  ON site_posts (collection, status, published_at DESC);

COMMENT ON TABLE site_posts IS
  'Artikel /blog & /market-insights yang dikelola dari /admin. Artikel lama tetap di kode; indeks menggabungkan keduanya.';
COMMENT ON COLUMN site_posts.content IS
  'Per bahasa: { id: { title, excerpt, body: Block[], ... }, en: {...} }. body berupa blok terstruktur, BUKAN HTML mentah.';

DROP TRIGGER IF EXISTS update_site_posts_updated_at ON site_posts;
CREATE TRIGGER update_site_posts_updated_at
  BEFORE UPDATE ON site_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — tulis & baca hanya platform admin
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Perhatikan: publik TIDAK diberi SELECT sama sekali, termasuk untuk konten
-- yang sudah dipublikasikan. Kalau anon boleh SELECT, `draft_content` ikut
-- terbaca — draft yang belum siap akan bocor ke siapa pun yang tahu memanggil
-- REST Supabase. Jalur baca publik lewat server (`createAdminClient()` di
-- dalam `unstable_cache`) yang hanya pernah mengeluarkan `published_content`.
-- Ini pola yang sama dengan /api/stats.

ALTER TABLE site_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_pages_platform_admin_all" ON site_pages;
CREATE POLICY "site_pages_platform_admin_all" ON site_pages
  FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "site_page_versions_platform_admin_read" ON site_page_versions;
CREATE POLICY "site_page_versions_platform_admin_read" ON site_page_versions
  FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "site_page_versions_platform_admin_insert" ON site_page_versions;
CREATE POLICY "site_page_versions_platform_admin_insert" ON site_page_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin());

-- Sengaja tanpa policy UPDATE/DELETE: riwayat publikasi append-only.

DROP POLICY IF EXISTS "site_posts_platform_admin_all" ON site_posts;
CREATE POLICY "site_posts_platform_admin_all" ON site_posts
  FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Seed baris halaman (kosong — default diambil dari kode)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO site_pages (page_key)
VALUES ('landing'), ('seo'), ('privacy'), ('terms'), ('blog_index'), ('market_insights')
ON CONFLICT (page_key) DO NOTHING;

-- ROLLBACK:
--   DROP TABLE IF EXISTS site_posts;
--   DROP TABLE IF EXISTS site_page_versions;
--   DROP TABLE IF EXISTS site_pages;
--   DROP FUNCTION IF EXISTS is_platform_admin();
