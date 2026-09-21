import { notFound } from 'next/navigation';
import { isPlatformAdmin } from '@/lib/api/server/platformAdmin';

/**
 * Gerbang seluruh area /admin.
 *
 * Server Component dengan sengaja, meski layout dashboard di atasnya adalah
 * Client Component. Menyembunyikan menu lewat `isSuperadmin` dari
 * BusinessContext saja tidak cukup — itu keputusan di browser, yang bisa
 * dilewati siapa pun dengan mengetik URL-nya. Di sini halaman tidak pernah
 * sampai terkirim ke non-admin.
 *
 * Lapisan ini yang ketiga, bukan satu-satunya: route handler memanggil
 * `requirePlatformAdmin`, dan RLS `site_pages` memakai `is_platform_admin()`.
 *
 * `notFound()` dipilih, bukan redirect ke login: keberadaan panel admin tidak
 * perlu diberitahukan ke orang yang tidak berhak.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isPlatformAdmin())) notFound();
  return <>{children}</>;
}
