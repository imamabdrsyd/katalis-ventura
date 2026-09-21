import LandingPageClient from '@/components/landing/LandingPageClient';
import { getLandingContent } from '@/lib/site/server';

/**
 * Landing page axionventura.com.
 *
 * Dulu seluruh halaman ini satu Client Component dengan teks hardcode. Sekarang
 * jadi shell Server Component tipis: isinya diambil dari Site CMS di server,
 * lalu diserahkan ke `LandingPageClient` yang memegang animasi & interaksi.
 *
 * Dua keuntungan dari memindahkannya ke server:
 *   - Teks ikut ter-render di HTML awal, jadi terbaca crawler. Versi lama
 *     merakit teks di klien.
 *   - Tidak ada kedipan "konten default → konten CMS" seperti kalau konten
 *     di-fetch dari useEffect.
 *
 * `revalidate` hanya jaring pengaman. Jalur utamanya `revalidateTag` yang
 * dipanggil route publish, sehingga perubahan tayang seketika.
 */
export const revalidate = 3600;

export default async function LandingPage() {
  const content = await getLandingContent();
  return <LandingPageClient content={content} />;
}
