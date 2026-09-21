/**
 * Kunci cache konten Site CMS.
 *
 * Sejalan dengan `src/lib/publicPageCache.ts` (tag cache halaman publik
 * omnichannel & daftar bisnis) — file terpisah, bukan digabung ke sana, supaya
 * tag milik CMS tidak tercampur dengan tag milik data bisnis; keduanya punya
 * pemicu invalidasi yang berbeda.
 *
 * Halaman publik membaca konten lewat `unstable_cache` bertag ini. Saat platform
 * admin menekan Publikasikan, route publish memanggil
 * `revalidateTag(sitePageCacheTag(key), 'max')` sehingga perubahan langsung tayang —
 * bukan menunggu TTL habis.
 */

import type { PostCollection, SitePageKey } from './types';

export function sitePageCacheTag(pageKey: SitePageKey): string {
  return `site-page:${pageKey}`;
}

/** Daftar artikel sebuah koleksi (indeks /blog, /market-insights, sitemap). */
export function sitePostsCacheTag(collection: PostCollection): string {
  return `site-posts:${collection}`;
}

/** Satu artikel — dipisah dari tag daftar agar edit satu artikel tidak membatalkan indeks. */
export function sitePostCacheTag(collection: PostCollection, slug: string): string {
  return `site-post:${collection}:${slug}`;
}

/**
 * Umur cache konten CMS. Panjang karena invalidasi sudah eksplisit lewat
 * `revalidateTag` saat publish — TTL di sini cuma jaring pengaman kalau ada
 * jalur tulis yang lupa membatalkan tag.
 */
export const SITE_CONTENT_REVALIDATE_SECONDS = 3600;
