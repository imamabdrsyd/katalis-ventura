import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LandingPageClient from '@/components/landing/LandingPageClient';
import { isPlatformAdmin } from '@/lib/api/server/platformAdmin';
import { getPageRecord, getPageDefaults } from '@/lib/site/server';
import { mergeSiteContent } from '@/lib/site/merge';

/**
 * Pratinjau draft landing page.
 *
 * Route terpisah — bukan `/?preview=1` — dengan sengaja. Membaca searchParams di
 * `app/page.tsx` akan memaksa landing page jadi dynamic rendering untuk SEMUA
 * pengunjung, menghapus manfaat static/ISR-nya demi fitur yang dipakai satu
 * orang. Di sini pratinjau boleh dynamic karena memang hanya admin yang membuka.
 *
 * Bagi non-admin halaman ini 404, bukan redirect ke login: keberadaan draft
 * tidak perlu bocor ke publik.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pratinjau Landing Page',
  // Draft tidak boleh ikut terindeks — kalau lolos, Google bisa menayangkan
  // teks yang belum disetujui dan halaman ini bersaing dengan `/` sendiri.
  robots: { index: false, follow: false, nocache: true },
};

export default async function LandingPreviewPage() {
  if (!(await isPlatformAdmin())) notFound();

  const record = await getPageRecord('landing');
  if (!record) notFound();

  const content = mergeSiteContent(getPageDefaults('landing'), record.draft);

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-full bg-gray-900 px-5 py-2.5 text-sm text-white shadow-lg dark:bg-white dark:text-gray-900">
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
        <span className="font-medium">Pratinjau draft — belum tayang</span>
        <a
          href="/admin/landing"
          className="font-semibold underline underline-offset-2 hover:opacity-80"
        >
          Kembali ke editor
        </a>
      </div>
      <LandingPageClient content={content} />
    </>
  );
}
