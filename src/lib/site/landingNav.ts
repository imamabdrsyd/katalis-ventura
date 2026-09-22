/**
 * Aturan "apakah tujuan sebuah link masih hidup" di landing page.
 *
 * Menyembunyikan section lewat `/admin` tidak boleh menyisakan link yang
 * menunjuk ke jangkar yang sudah tidak dirender — menu navbar yang diklik lalu
 * tidak terjadi apa-apa lebih membingungkan daripada menu yang tidak ada.
 *
 * Dipakai di DUA tempat, jadi tinggal di sini supaya tidak melenceng:
 *   - `LandingPageClient` — menyaring menu navbar & tombol kedua hero
 *   - `LandingEditor`     — menandai menu yang tujuannya sedang disembunyikan,
 *                           supaya centang "Tampilkan menu ini" tidak terlihat rusak
 */

import { LANDING_ANCHOR_TO_SECTION, type LandingContent, type LandingSectionKey } from './types';

/** Key section yang dituju sebuah href, atau null bila bukan jangkar section. */
export function anchorSectionKey(href: string): LandingSectionKey | null {
  if (!href.startsWith('#')) return null;
  return LANDING_ANCHOR_TO_SECTION[href.slice(1)] ?? null;
}

/**
 * Section benar-benar dirender?
 *
 * Dua hal sama-sama membuatnya absen: flag `visible` mati, atau key-nya tidak
 * ada di `sectionOrder` (renderer hanya menjalankan key yang tercantum di sana).
 */
export function isSectionRendered(content: LandingContent, key: LandingSectionKey): boolean {
  return content.sections[key].visible && content.sectionOrder.includes(key);
}

/**
 * Link ini masih punya tujuan?
 *
 * Link non-anchor (`/blog`, `https://…`) selalu dianggap valid — tujuannya di
 * luar jangkauan aturan ini. Begitu juga anchor ke elemen yang bukan section.
 */
export function hasLiveTarget(content: LandingContent, href: string): boolean {
  const key = anchorSectionKey(href);
  if (!key) return true;
  return isSectionRendered(content, key);
}
