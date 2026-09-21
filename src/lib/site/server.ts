import 'server-only';

/**
 * Jalur BACA konten Site CMS untuk halaman publik.
 *
 * Tiga hal yang dijaga di sini:
 *
 * 1. Publik hanya pernah melihat `published_content`. Draft tidak pernah keluar
 *    dari modul ini kecuali lewat `getDraftContent`, yang pemanggilnya wajib
 *    sudah memverifikasi platform admin.
 *
 * 2. Baca memakai `createAdminClient()`, bukan client beranotasi sesi. RLS
 *    `site_pages` sengaja tidak memberi SELECT ke anon (kalau diberi,
 *    `draft_content` ikut terbaca lewat REST Supabase oleh siapa pun). Jadi
 *    halaman publik — yang memang tanpa sesi — mengambilnya lewat service role
 *    di server. Pola yang sama dipakai /api/stats.
 *
 * 3. Hasilnya selalu di-merge di atas default kode, jadi kegagalan baca, baris
 *    kosong, atau dokumen usang tidak pernah membuat halaman blank.
 */

import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase-server';
import { mergeSiteContent } from './merge';
import { SITE_CONTENT_REVALIDATE_SECONDS, sitePageCacheTag } from './cache';
import { LANDING_DEFAULTS } from './defaults/landing';
import { SEO_DEFAULTS } from './defaults/seo';
import { PRIVACY_DEFAULTS } from './defaults/privacy';
import { TERMS_DEFAULTS } from './defaults/terms';
import {
  BLOG_INDEX_DEFAULTS,
  MARKET_INSIGHTS_INDEX_DEFAULTS,
} from './defaults/collections';
import type {
  CollectionIndexContent,
  LandingContent,
  LegalContent,
  SeoContent,
  SitePageKey,
} from './types';

/**
 * Ambil `published_content` mentah satu halaman.
 *
 * Kegagalan di sini TIDAK dilempar. Landing page adalah muka publik situs;
 * kalau Supabase sedang tidak bisa dihubungi, halaman harus tetap tampil dengan
 * teks default, bukan menampilkan error. Kegagalannya dicatat ke log supaya
 * tetap terlihat.
 */
async function fetchPublishedContent(pageKey: SitePageKey): Promise<unknown> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('site_pages')
      .select('published_content')
      .eq('page_key', pageKey)
      .maybeSingle();

    if (error) {
      console.error(`[site-cms] gagal membaca konten "${pageKey}":`, error.message);
      return null;
    }

    return data?.published_content ?? null;
  } catch (error) {
    console.error(`[site-cms] gagal membaca konten "${pageKey}":`, error);
    return null;
  }
}

/**
 * Bungkus pembacaan satu halaman dengan cache bertag, supaya publish bisa
 * membatalkannya seketika lewat `revalidateTag`.
 */
function cachedPublishedContent(pageKey: SitePageKey) {
  return unstable_cache(
    () => fetchPublishedContent(pageKey),
    ['site-page', pageKey],
    {
      tags: [sitePageCacheTag(pageKey)],
      revalidate: SITE_CONTENT_REVALIDATE_SECONDS,
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pembaca per halaman
// ─────────────────────────────────────────────────────────────────────────────

export async function getLandingContent(): Promise<LandingContent> {
  const published = await cachedPublishedContent('landing')();
  return mergeSiteContent(LANDING_DEFAULTS, published);
}

export async function getSeoContent(): Promise<SeoContent> {
  const published = await cachedPublishedContent('seo')();
  return mergeSiteContent(SEO_DEFAULTS, published);
}

export async function getLegalContent(pageKey: 'privacy' | 'terms'): Promise<LegalContent> {
  const published = await cachedPublishedContent(pageKey)();
  return mergeSiteContent(LEGAL_DEFAULTS[pageKey], published);
}

const LEGAL_DEFAULTS: Record<'privacy' | 'terms', LegalContent> = {
  privacy: PRIVACY_DEFAULTS,
  terms: TERMS_DEFAULTS,
};

export async function getCollectionIndexContent(
  pageKey: 'blog_index' | 'market_insights'
): Promise<CollectionIndexContent> {
  const published = await cachedPublishedContent(pageKey)();
  return mergeSiteContent(COLLECTION_INDEX_DEFAULTS[pageKey], published);
}

const COLLECTION_INDEX_DEFAULTS: Record<
  'blog_index' | 'market_insights',
  CollectionIndexContent
> = {
  blog_index: BLOG_INDEX_DEFAULTS,
  market_insights: MARKET_INSIGHTS_INDEX_DEFAULTS,
};

// ─────────────────────────────────────────────────────────────────────────────
// Jalur admin: draft (tanpa cache)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Baca draft + published satu halaman untuk editor admin.
 *
 * TIDAK di-cache: admin harus selalu melihat draft terbarunya, dan halaman ini
 * hanya dibuka satu-dua orang. Pemanggil WAJIB sudah lolos `requirePlatformAdmin`
 * — fungsi ini tidak memeriksa otoritas sendiri.
 */
export async function getPageRecord(pageKey: SitePageKey): Promise<{
  draft: unknown;
  published: unknown;
  publishedAt: string | null;
  updatedAt: string;
} | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('site_pages')
    .select('draft_content, published_content, published_at, updated_at')
    .eq('page_key', pageKey)
    .maybeSingle();

  if (error) {
    console.error(`[site-cms] gagal membaca draft "${pageKey}":`, error.message);
    return null;
  }
  if (!data) return null;

  return {
    draft: data.draft_content ?? null,
    published: data.published_content ?? null,
    publishedAt: data.published_at,
    updatedAt: data.updated_at,
  };
}

/** Default kode per halaman — dipakai editor sebagai titik awal & dasar merge. */
export function getPageDefaults(pageKey: 'landing'): LandingContent;
export function getPageDefaults(pageKey: 'seo'): SeoContent;
export function getPageDefaults(pageKey: 'privacy' | 'terms'): LegalContent;
export function getPageDefaults(
  pageKey: 'blog_index' | 'market_insights'
): CollectionIndexContent;
export function getPageDefaults(pageKey: SitePageKey): unknown;
export function getPageDefaults(pageKey: SitePageKey): unknown {
  switch (pageKey) {
    case 'landing':
      return LANDING_DEFAULTS;
    case 'seo':
      return SEO_DEFAULTS;
    case 'privacy':
      return PRIVACY_DEFAULTS;
    case 'terms':
      return TERMS_DEFAULTS;
    case 'blog_index':
      return BLOG_INDEX_DEFAULTS;
    case 'market_insights':
      return MARKET_INSIGHTS_INDEX_DEFAULTS;
  }
}
