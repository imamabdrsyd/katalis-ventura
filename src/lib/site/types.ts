/**
 * Tipe konten situs publik yang dikelola platform admin (Site CMS).
 *
 * Pola yang dipakai: SECTION SLOT, bukan page builder.
 *   - Layout, animasi, dan komponen interaktif tetap di kode.
 *   - Yang pindah ke DB hanya ISI: teks per bahasa, urutan section, on/off,
 *     target link, dan sumber gambar.
 *
 * Konsekuensi yang disengaja: admin tidak bisa menambah section bertipe baru
 * atau mengubah tata letak. Landing page ini desainnya bespoke (grid berbeda
 * tiap section + framer-motion), jadi kebebasan penuh justru gampang merusak
 * tampilan. Menambah tipe section = tambah entri di sini + renderer-nya.
 *
 * Setiap dokumen di DB selalu di-merge di atas default yang ada di kode
 * (lihat `mergeSiteContent`), sehingga tipe ini menggambarkan bentuk LENGKAP
 * sementara isi DB boleh parsial.
 */

export type Locale = 'id' | 'en';

/** Satu string dalam dua bahasa. Semua teks yang tampil ke publik memakai ini. */
export type LocalizedText = Record<Locale, string>;

export interface SiteCta {
  label: LocalizedText;
  href: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing page
// ─────────────────────────────────────────────────────────────────────────────

export const LANDING_SECTION_KEYS = [
  'accounting',
  'ssot',
  'omnichannel',
  'ecommerce',
  'health',
] as const;

export type LandingSectionKey = (typeof LANDING_SECTION_KEYS)[number];

/** Kepala section: eyebrow + judul + paragraf pengantar. Dipakai semua section. */
export interface LandingSectionHeader {
  visible: boolean;
  eyebrow: LocalizedText;
  title: LocalizedText;
  lead: LocalizedText;
}

export interface LandingNavItem {
  /** Kunci stabil — dipakai React key & anchor, tidak ditampilkan. */
  key: string;
  label: LocalizedText;
  href: string;
  visible: boolean;
}

export interface LandingFeatureItem {
  /** Nomor urut yang tampil ('01', '02', ...). Teks bebas, bukan angka. */
  n: string;
  title: LocalizedText;
  body: LocalizedText;
}

export interface LandingLogo {
  name: string;
  src: string;
}

export interface LandingFooterLink {
  /** Label apa adanya (nama akun / alamat email) — tidak diterjemahkan. */
  label: string;
  href: string;
}

export interface LandingContent {
  nav: {
    items: LandingNavItem[];
    loginLabel: LocalizedText;
  };
  hero: {
    eyebrow: LocalizedText;
    title1: LocalizedText;
    title2: LocalizedText;
    subtitle: LocalizedText;
    primaryCta: SiteCta;
    secondaryCta: SiteCta;
    /** Tangkapan layar produk; dua berkas karena mode terang & gelap berbeda. */
    imageLight: string;
    imageDark: string;
  };
  /**
   * Trust strip: eyebrow + tiga angka + marquee logo bisnis.
   * Angkanya datang dari /api/stats (bukan dari sini) — yang bisa disunting
   * hanya labelnya. Kurasi bisnis mana yang muncul di marquee tetap lewat
   * toggle `businesses.show_in_logo_slide` di halaman bisnis masing-masing.
   */
  trustStrip: {
    visible: boolean;
    eyebrow: LocalizedText;
    usersLabel: LocalizedText;
    businessesLabel: LocalizedText;
    privacyLabel: LocalizedText;
  };
  /** Urutan tayang section. Key yang tidak tercantum tidak dirender. */
  sectionOrder: LandingSectionKey[];
  sections: {
    accounting: LandingSectionHeader & { items: LandingFeatureItem[] };
    ssot: LandingSectionHeader;
    omnichannel: LandingSectionHeader;
    ecommerce: LandingSectionHeader & { logos: LandingLogo[] };
    health: LandingSectionHeader & { fullLinkLabel: LocalizedText };
  };
  closing: {
    visible: boolean;
    eyebrow: LocalizedText;
    title: LocalizedText;
    lead: LocalizedText;
    cta: SiteCta;
  };
  footer: {
    label: LocalizedText;
    cta: SiteCta;
    copyright: LocalizedText;
    privacyLabel: LocalizedText;
    termsLabel: LocalizedText;
    blogLabel: LocalizedText;
    links: LandingFooterLink[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata SEO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hanya bagian metadata yang memang layak diubah tanpa deploy. Ikon, favicon,
 * dan `metadataBase` sengaja TIDAK di sini: nilainya terikat ke berkas di
 * /public dan domain, salah ketik di situ merusak seluruh situs tanpa gejala
 * yang kelihatan di halaman.
 */
export interface SeoContent {
  siteTitle: string;
  titleTemplate: string;
  description: string;
  keywords: string[];
  openGraph: {
    title: string;
    description: string;
    imageUrl: string;
    imageAlt: string;
  };
  twitter: {
    title: string;
    description: string;
    creator: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Halaman legal (/privacy, /terms) & body artikel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Blok terstruktur, BUKAN HTML mentah.
 *
 * Alasannya dua. Pertama, halaman legal & artikel dirender dengan komponen
 * desain sendiri (`LegalPage`, `Section`, `List`, `Callout`) — blok memetakan
 * satu-satu ke komponen itu sehingga tampilannya tetap konsisten. Kedua, HTML
 * mentah dari form admin berarti jalur injeksi; blok menutupnya karena teks
 * selalu dirender sebagai teks.
 *
 * Blok SATU BAHASA, bukan `LocalizedText`. Kebahasaan ditangani satu tingkat di
 * atas: halaman legal memang hanya bahasa Indonesia (menerjemahkan dokumen yang
 * mengikat secara hukum butuh penerjemah, bukan field kosong di form), dan
 * artikel menyimpan `body` terpisah per bahasa (lihat `SitePostContent.locales`).
 * Menempelkan dua bahasa ke setiap blok akan memaksa keduanya punya struktur
 * paragraf yang identik — asumsi yang tidak berlaku untuk prosa panjang.
 *
 * `text` mendukung penekanan inline terbatas: `**tebal**`, `*miring*`,
 * `` `kode` ``, dan `[teks](url)` — lihat `src/lib/site/inlineMarkup.ts`.
 */
export type ContentBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'callout'; tone: 'info' | 'warning' | 'success'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; src: string; alt: string; caption?: string };

export interface LegalSection {
  heading: string;
  blocks: ContentBlock[];
}

export interface LegalContent {
  title: string;
  /** Tanggal berlaku sebagai teks, mis. "6 Agustus 2026". */
  effectiveDate: string;
  intro: string;
  sections: LegalSection[];
  seo: {
    title: string;
    description: string;
  };
}

/**
 * Kepala halaman indeks koleksi (/blog, /market-insights).
 *
 * Satu bahasa, sama seperti halaman yang tayang sekarang — keduanya memang tidak
 * punya pengalih bahasa sendiri (yang di footer landing page hanya memengaruhi
 * landing page).
 */
export interface CollectionIndexContent {
  eyebrow: string;
  title: string;
  lead: string;
  seo: {
    title: string;
    description: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Artikel (site_posts)
// ─────────────────────────────────────────────────────────────────────────────

export type PostCollection = 'blog' | 'market_insights';
export type PostStatus = 'draft' | 'published';

export interface PostLocaleContent {
  title: string;
  excerpt: string;
  body: ContentBlock[];
}

export interface SitePostContent {
  category: string;
  author: string;
  readingMinutes: number;
  keywords: string[];
  /** Kosong pada satu bahasa = artikel hanya tayang di bahasa yang terisi. */
  locales: Partial<Record<Locale, PostLocaleContent>>;
}

export interface SitePost {
  id: string;
  collection: PostCollection;
  slug: string;
  status: PostStatus;
  publishedAt: string | null;
  updatedAt: string;
  coverImageUrl: string | null;
  sortOrder: number;
  content: SitePostContent;
}

// ─────────────────────────────────────────────────────────────────────────────
// Peta page_key → bentuk kontennya
// ─────────────────────────────────────────────────────────────────────────────

export const SITE_PAGE_KEYS = [
  'landing',
  'seo',
  'privacy',
  'terms',
  'blog_index',
  'market_insights',
] as const;

export type SitePageKey = (typeof SITE_PAGE_KEYS)[number];

export interface SitePageContentMap {
  landing: LandingContent;
  seo: SeoContent;
  privacy: LegalContent;
  terms: LegalContent;
  blog_index: CollectionIndexContent;
  market_insights: CollectionIndexContent;
}

/** Baris `site_pages` sebagaimana dipakai halaman admin. */
export interface SitePageRecord<K extends SitePageKey = SitePageKey> {
  pageKey: K;
  draft: SitePageContentMap[K];
  /** null = halaman belum pernah dipublikasikan; publik melihat default kode. */
  published: SitePageContentMap[K] | null;
  publishedAt: string | null;
  updatedAt: string;
  /** true bila draft berbeda dari yang sedang tayang. */
  hasUnpublishedChanges: boolean;
}

export interface SitePageVersion {
  id: string;
  pageKey: SitePageKey;
  label: string | null;
  createdAt: string;
}
