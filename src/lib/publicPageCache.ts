/**
 * Kunci cache halaman publik omnichannel (`/[slug]`).
 *
 * Ada di modul sendiri, BUKAN di `app/[slug]/page.tsx`, karena Next.js melarang
 * named export sembarangan dari file `page` — satu-satunya export yang boleh di
 * sana cuma yang dikenal framework (default, generateMetadata, revalidate, dst).
 *
 * Data halaman publik di-cache 60 detik lewat `unstable_cache` dengan tag ini.
 * Route yang mengubah isinya memanggil `revalidateTag(publicSlugCacheTag(slug))`
 * supaya perubahan langsung terlihat, bukan menunggu 60 detik:
 *   - PUT /api/omni-channel/[businessId]  → owner menyimpan konfigurasi halaman
 *   - POST /api/public/events/register    → pendaftar baru mengubah hitungan slot
 */
export function publicSlugCacheTag(slug: string): string {
  return `public-slug:${slug}`;
}
