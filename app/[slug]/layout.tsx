import type { Viewport } from 'next';
import { PublicThemeLock } from '@/components/public/PublicThemeLock';

/**
 * Layout seluruh halaman publik omnichannel (`/[slug]` + Lobby event di
 * bawahnya). Tugas utamanya satu: memastikan halaman ini SELALU terang.
 *
 * Dua lapis, karena keduanya menutup celah yang berbeda:
 * 1. Skrip di bawah berjalan sebelum paint pertama — mencegah kedipan gelap
 *    (skrip next-themes di root layout sudah menyisipkan kelas 'dark' lebih
 *    dulu bila HP pengunjung dark mode; skrip ini jalan sesudahnya).
 * 2. <PublicThemeLock /> mempertahankannya setelah hidrasi, saat provider tema
 *    root menerapkan ulang preferensi tersimpan.
 */

const FORCE_LIGHT_SCRIPT = `(function(){try{var r=document.documentElement;r.classList.remove('dark','midnight');r.classList.add('light');r.style.colorScheme='light';}catch(e){}})();`;

// Warna chrome browser ikut terang di seluruh cabang publik (root layout
// memakai warna yang mengikuti prefers-color-scheme).
export const viewport: Viewport = {
  themeColor: '#F7F8FA',
};

export default function SlugLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: FORCE_LIGHT_SCRIPT }} />
      <PublicThemeLock />
      {children}
    </>
  );
}
