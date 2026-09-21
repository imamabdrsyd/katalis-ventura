import Link from 'next/link';
import { FileText, Globe, Newspaper, Scale } from 'lucide-react';

/**
 * Beranda panel platform admin: daftar apa saja yang bisa dikelola.
 *
 * Halaman yang belum punya editor tetap ditampilkan dengan penanda, bukan
 * disembunyikan — supaya jelas apa yang sudah dan belum dikelola dari sini,
 * dan tidak ada yang mengira teksnya bisa diubah padahal masih di kode.
 */

const ENTRIES = [
  {
    href: '/admin/landing',
    icon: Globe,
    title: 'Landing Page',
    description:
      'Teks hero, urutan section, tombol, dan footer halaman depan axionventura.com.',
    ready: true,
  },
  {
    href: '/admin/seo',
    icon: FileText,
    title: 'Metadata SEO',
    description:
      'Judul & deskripsi di Google, serta kartu yang muncul saat link dibagikan.',
    ready: true,
  },
  {
    href: '/admin/legal/privacy',
    icon: Scale,
    title: 'Kebijakan Privasi',
    description:
      'Isi /privacy. Diverifikasi Google saat consent screen OAuth dipublish — ubah dengan hati-hati.',
    ready: true,
  },
  {
    href: '/admin/legal/terms',
    icon: Scale,
    title: 'Syarat & Ketentuan',
    description: 'Isi /terms — layanan, akun, kepemilikan data, batasan tanggung jawab.',
    ready: true,
  },
  {
    href: '/admin/posts',
    icon: Newspaper,
    title: 'Blog & Market Insights',
    description:
      'Tulis artikel /blog, dan atur kepala halaman /blog serta /market-insights.',
    ready: true,
  },
];

export default function AdminHomePage() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Konten Situs
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Kelola apa yang tampil di halaman publik axionventura.com tanpa perlu deploy.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {ENTRIES.map(({ href, icon: Icon, title, description, ready }) => {
          const body = (
            <>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-gray-100">
                {title}
                {!ready && (
                  <span className="badge bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    Belum tersedia
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
            </>
          );

          if (!ready) {
            return (
              <div key={href} className="card-static opacity-60">
                {body}
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                  Masih dikelola lewat kode — perubahan butuh deploy.
                </p>
              </div>
            );
          }

          return (
            <Link key={href} href={href} className="card block">
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
