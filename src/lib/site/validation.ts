/**
 * Skema Zod untuk konten Site CMS.
 *
 * Editor di /admin selalu mengirim dokumen UTUH (dibangun dari hasil merge
 * default + draft), jadi skema di sini sengaja ketat — bukan `.partial()`.
 * Dokumen parsial hanya ditoleransi di jalur BACA lewat `mergeSiteContent`,
 * supaya dokumen lama yang belum punya field baru tetap bisa dirender.
 */

import { z } from 'zod';
import { LANDING_SECTION_KEYS } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Primitif
// ─────────────────────────────────────────────────────────────────────────────

const shortText = z.string().max(300);
const longText = z.string().max(4000);

const localizedText = (schema: z.ZodString = shortText) =>
  z.object({ id: schema, en: schema });

/**
 * Penyaring URL.
 *
 * Nilai ini berakhir di atribut `href`, jadi `javascript:` / `data:` harus
 * ditolak — kalau lolos, form admin jadi jalur stored XSS bagi setiap pengunjung
 * landing page. Memang hanya platform admin yang bisa menulis, tapi pertahanan
 * berlapis di sini murah dan sekaligus menangkap salah tempel.
 *
 * Yang diizinkan: path relatif (`/login`), anchor (`#section-ssot`),
 * http/https, dan mailto.
 */
const SAFE_HREF = /^(?:\/(?!\/)[^\s]*|#[^\s]*|https?:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/;

const safeHref = z
  .string()
  .max(500)
  .refine((value) => SAFE_HREF.test(value), {
    message:
      'Link harus berupa path relatif (/login), anchor (#section), http(s)://, atau mailto:',
  });

/**
 * Sumber gambar. Dibatasi ke path lokal /images/... atau URL https, dan
 * ekstensi gambar yang wajar — `next/image` akan menolak host yang tidak
 * terdaftar di next.config, jadi nilai asal justru membuat gambar hilang
 * tanpa pesan yang jelas.
 */
const imageSrc = z
  .string()
  .max(500)
  .refine((value) => /^\/[^\s]+\.(png|jpg|jpeg|webp|avif|svg)$/i.test(value) || /^https:\/\/[^\s]+$/i.test(value), {
    message: 'Gambar harus path lokal (/images/foo.png) atau URL https://',
  });

const cta = z.object({
  label: localizedText(),
  href: safeHref,
});

// ─────────────────────────────────────────────────────────────────────────────
// Landing page
// ─────────────────────────────────────────────────────────────────────────────

const sectionHeader = z.object({
  visible: z.boolean(),
  eyebrow: localizedText(),
  title: localizedText(z.string().max(500)),
  lead: localizedText(longText),
});

export const landingContentSchema = z.object({
  nav: z.object({
    items: z
      .array(
        z.object({
          key: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Kunci hanya huruf kecil, angka, dan tanda hubung'),
          label: localizedText(),
          href: safeHref,
          visible: z.boolean(),
        })
      )
      .max(8),
    loginLabel: localizedText(),
  }),

  hero: z.object({
    eyebrow: localizedText(),
    title1: localizedText(),
    title2: localizedText(),
    subtitle: localizedText(longText),
    primaryCta: cta,
    secondaryCta: cta,
    imageLight: imageSrc,
    imageDark: imageSrc,
  }),

  trustStrip: z.object({
    visible: z.boolean(),
    eyebrow: localizedText(),
    usersLabel: localizedText(),
    businessesLabel: localizedText(),
    privacyLabel: localizedText(),
  }),

  /**
   * Urutan render. Boleh memuat sebagian key saja — key yang tidak tercantum
   * tidak dirender, jadi ini juga cara menyembunyikan section selain flag
   * `visible`. Duplikat ditolak supaya satu section tidak tampil dua kali.
   */
  sectionOrder: z
    .array(z.enum(LANDING_SECTION_KEYS))
    .max(LANDING_SECTION_KEYS.length)
    .refine((keys) => new Set(keys).size === keys.length, {
      message: 'Urutan section tidak boleh memuat key ganda',
    }),

  sections: z.object({
    accounting: sectionHeader.extend({
      items: z
        .array(
          z.object({
            n: z.string().max(10),
            title: localizedText(),
            body: localizedText(longText),
          })
        )
        .max(12),
    }),
    ssot: sectionHeader,
    omnichannel: sectionHeader,
    ecommerce: sectionHeader.extend({
      logos: z
        .array(z.object({ name: z.string().min(1).max(60), src: imageSrc }))
        .max(12),
    }),
    health: sectionHeader.extend({
      fullLinkLabel: localizedText(),
    }),
  }),

  closing: z.object({
    visible: z.boolean(),
    eyebrow: localizedText(),
    title: localizedText(z.string().max(500)),
    lead: localizedText(longText),
    cta,
  }),

  footer: z.object({
    label: localizedText(),
    cta,
    copyright: localizedText(),
    privacyLabel: localizedText(),
    termsLabel: localizedText(),
    blogLabel: localizedText(),
    links: z
      .array(z.object({ label: z.string().min(1).max(120), href: safeHref }))
      .max(8),
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// SEO
// ─────────────────────────────────────────────────────────────────────────────

export const seoContentSchema = z.object({
  siteTitle: z.string().min(1).max(200),
  /** Wajib memuat %s — tanpa itu semua halaman anak kehilangan judulnya sendiri. */
  titleTemplate: z
    .string()
    .min(1)
    .max(100)
    .refine((value) => value.includes('%s'), {
      message: 'Template judul harus memuat %s sebagai tempat judul halaman',
    }),
  description: z.string().min(1).max(500),
  keywords: z.array(z.string().min(1).max(100)).max(40),
  openGraph: z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(500),
    imageUrl: imageSrc,
    imageAlt: z.string().min(1).max(200),
  }),
  twitter: z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(500),
    creator: z.string().max(50),
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Blok konten (halaman legal & artikel)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Blok satu bahasa — lihat catatan di `ContentBlock` (types.ts) soal kenapa
 * kebahasaan ditangani satu tingkat di atas, bukan per blok.
 */
export const contentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), text: z.string().max(300) }),
  z.object({ type: z.literal('paragraph'), text: longText }),
  z.object({
    type: z.literal('list'),
    ordered: z.boolean().optional(),
    items: z.array(longText).max(50),
  }),
  z.object({
    type: z.literal('callout'),
    tone: z.enum(['info', 'warning', 'success']),
    text: longText,
  }),
  z.object({
    type: z.literal('table'),
    headers: z.array(shortText).max(8),
    rows: z.array(z.array(longText).max(8)).max(60),
  }),
  z.object({
    type: z.literal('image'),
    src: imageSrc,
    alt: shortText,
    caption: shortText.optional(),
  }),
]);

export const legalContentSchema = z.object({
  title: shortText.min(1),
  effectiveDate: shortText.min(1),
  intro: longText,
  sections: z
    .array(
      z.object({
        heading: z.string().min(1).max(300),
        blocks: z.array(contentBlockSchema).max(80),
      })
    )
    .max(40),
  seo: z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(500),
  }),
});

export const collectionIndexContentSchema = z.object({
  eyebrow: localizedText(),
  title: localizedText(z.string().max(300)),
  lead: localizedText(longText),
  seo: z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(500),
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Artikel
// ─────────────────────────────────────────────────────────────────────────────

const postLocaleContentSchema = z.object({
  title: z.string().min(1).max(300),
  excerpt: z.string().max(1000),
  body: z.array(contentBlockSchema).max(200),
});

export const sitePostContentSchema = z.object({
  category: z.string().max(80),
  author: z.string().max(120),
  readingMinutes: z.number().int().min(0).max(120),
  keywords: z.array(z.string().min(1).max(100)).max(30),
  locales: z
    .object({
      id: postLocaleContentSchema.optional(),
      en: postLocaleContentSchema.optional(),
    })
    .refine((value) => Boolean(value.id || value.en), {
      message: 'Artikel harus punya isi minimal di satu bahasa',
    }),
});

/**
 * Slug artikel. Reserved word dijaga di sisi route: `/blog/<slug>` tidak boleh
 * menabrak artikel yang masih hidup di kode (lihat `getCodePostSlugs`).
 */
export const postSlugSchema = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya huruf kecil, angka, dan tanda hubung');

export const sitePostUpsertSchema = z.object({
  collection: z.enum(['blog', 'market_insights']),
  slug: postSlugSchema,
  status: z.enum(['draft', 'published']),
  publishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/, 'Tanggal terbit harus format YYYY-MM-DD')
    .nullable()
    .optional(),
  coverImageUrl: imageSrc.nullable().optional(),
  sortOrder: z.number().int().min(-1000).max(1000).optional(),
  content: sitePostContentSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Peta page_key → skema
// ─────────────────────────────────────────────────────────────────────────────

export const SITE_PAGE_SCHEMAS = {
  landing: landingContentSchema,
  seo: seoContentSchema,
  privacy: legalContentSchema,
  terms: legalContentSchema,
  blog_index: collectionIndexContentSchema,
  market_insights: collectionIndexContentSchema,
} as const;
