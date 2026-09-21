import 'server-only';

/**
 * Jalur BACA artikel (`site_posts`) untuk halaman publik.
 *
 * Keputusan penting: artikel yang sudah ada TETAP HIDUP DI KODE.
 * `src/lib/blog/posts.ts` + `app/blog/<slug>/page.tsx` berisi artikel dengan
 * body JSX bespoke 400+ baris yang sudah terindeks Google. Menyandikannya ulang
 * jadi blok berarti mengorbankan halaman yang sudah bekerja demi keseragaman
 * internal — bukan pertukaran yang sehat. Jadi indeks /blog MENGGABUNGKAN dua
 * sumber, dan artikel baru dibuat lewat CMS.
 *
 * Konsekuensi yang dijaga: slug artikel kode tidak boleh diklaim artikel CMS,
 * kalau tidak route statis `app/blog/<slug>` akan menang dan artikel CMS-nya
 * jadi tidak pernah terbuka. `isCodePostSlug()` yang menutupnya, dipakai saat
 * validasi simpan di route admin.
 */

import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase-server';
import { BLOG_POSTS } from '@/lib/blog/posts';
import { SITE_CONTENT_REVALIDATE_SECONDS, sitePostsCacheTag, sitePostCacheTag } from './cache';
import type {
  Locale,
  PostCollection,
  PostLocaleContent,
  SitePost,
  SitePostContent,
} from './types';

/** Ringkasan satu artikel untuk halaman indeks — menyatukan artikel kode & CMS. */
export interface PostSummary {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  category: string;
  readingMinutes: number;
  /** Dari mana artikel ini berasal — dipakai panel admin, tidak tampil ke publik. */
  source: 'code' | 'cms';
}

export function isCodePostSlug(slug: string): boolean {
  return BLOG_POSTS.some((post) => post.slug === slug);
}

/** Ambil isi artikel pada bahasa tertentu, jatuh ke bahasa lain bila kosong. */
function pickLocale(
  content: SitePostContent,
  locale: Locale
): PostLocaleContent | null {
  return content.locales?.[locale] ?? content.locales?.[locale === 'id' ? 'en' : 'id'] ?? null;
}

function toSitePost(row: Record<string, unknown>): SitePost {
  return {
    id: row.id as string,
    collection: row.collection as PostCollection,
    slug: row.slug as string,
    status: row.status as SitePost['status'],
    publishedAt: (row.published_at as string | null) ?? null,
    updatedAt: row.updated_at as string,
    coverImageUrl: (row.cover_image_url as string | null) ?? null,
    sortOrder: (row.sort_order as number) ?? 0,
    content: (row.content ?? {}) as SitePostContent,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Publik
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPublishedPosts(collection: PostCollection): Promise<SitePost[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('site_posts')
      .select('*')
      .eq('collection', collection)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) {
      console.error(`[site-cms] gagal membaca artikel "${collection}":`, error.message);
      return [];
    }
    return (data ?? []).map(toSitePost);
  } catch (error) {
    console.error(`[site-cms] gagal membaca artikel "${collection}":`, error);
    return [];
  }
}

function cachedPublishedPosts(collection: PostCollection) {
  return unstable_cache(() => fetchPublishedPosts(collection), ['site-posts', collection], {
    tags: [sitePostsCacheTag(collection)],
    revalidate: SITE_CONTENT_REVALIDATE_SECONDS,
  });
}

/**
 * Daftar artikel untuk halaman indeks: artikel kode + artikel CMS, terurut dari
 * yang terbaru. Untuk market_insights tidak ada artikel kode, jadi isinya CMS saja.
 */
export async function getPostSummaries(
  collection: PostCollection,
  locale: Locale = 'id'
): Promise<PostSummary[]> {
  const cmsPosts = await cachedPublishedPosts(collection)();

  const fromCms: PostSummary[] = cmsPosts.flatMap((post) => {
    const localized = pickLocale(post.content, locale);
    // Artikel tanpa isi di bahasa mana pun dilewati — lebih baik tidak muncul
    // daripada muncul sebagai kartu tanpa judul.
    if (!localized?.title) return [];
    return [
      {
        slug: post.slug,
        title: localized.title,
        description: localized.excerpt,
        publishedAt: post.publishedAt ?? post.updatedAt,
        category: post.content.category ?? '',
        readingMinutes: post.content.readingMinutes ?? 0,
        source: 'cms' as const,
      },
    ];
  });

  const fromCode: PostSummary[] =
    collection === 'blog'
      ? BLOG_POSTS.map((post) => ({
          slug: post.slug,
          title: post.title,
          description: post.description,
          publishedAt: post.publishedAt,
          category: post.category,
          readingMinutes: post.readingMinutes,
          source: 'code' as const,
        }))
      : [];

  return [...fromCode, ...fromCms].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

async function fetchPublishedPost(
  collection: PostCollection,
  slug: string
): Promise<SitePost | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('site_posts')
      .select('*')
      .eq('collection', collection)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      console.error(`[site-cms] gagal membaca artikel "${slug}":`, error.message);
      return null;
    }
    return data ? toSitePost(data) : null;
  } catch (error) {
    console.error(`[site-cms] gagal membaca artikel "${slug}":`, error);
    return null;
  }
}

export async function getPublishedPost(
  collection: PostCollection,
  slug: string
): Promise<SitePost | null> {
  return unstable_cache(
    () => fetchPublishedPost(collection, slug),
    ['site-post', collection, slug],
    {
      tags: [sitePostCacheTag(collection, slug)],
      revalidate: SITE_CONTENT_REVALIDATE_SECONDS,
    }
  )();
}

/** Isi artikel pada bahasa tertentu — dipakai halaman artikel & metadata-nya. */
export function getPostLocale(post: SitePost, locale: Locale = 'id'): PostLocaleContent | null {
  return pickLocale(post.content, locale);
}

/** Slug artikel CMS yang sudah tayang — dipakai sitemap. */
export async function getPublishedPostSlugs(
  collection: PostCollection
): Promise<{ slug: string; updatedAt: string }[]> {
  const posts = await cachedPublishedPosts(collection)();
  return posts.map((post) => ({ slug: post.slug, updatedAt: post.updatedAt }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin (tanpa cache — draft harus selalu yang terbaru)
// ─────────────────────────────────────────────────────────────────────────────

/** Pemanggil WAJIB sudah lolos `requirePlatformAdmin`. */
export async function getAllPosts(collection: PostCollection): Promise<SitePost[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('site_posts')
    .select('*')
    .eq('collection', collection)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error(`[site-cms] gagal membaca daftar artikel "${collection}":`, error.message);
    return [];
  }
  return (data ?? []).map(toSitePost);
}
