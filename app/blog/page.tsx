import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { BLOG_POSTS } from '@/lib/blog/posts';

export const metadata: Metadata = {
  title: 'Blog AXION — Panduan Akuntansi & Keuangan untuk UMKM Indonesia',
  description:
    'Kumpulan panduan praktis akuntansi, pembukuan, dan keuangan bisnis untuk UMKM Indonesia. Belajar laporan laba rugi, neraca, arus kas, dan analisis ROI.',
  alternates: { canonical: 'https://axionventura.com/blog' },
  openGraph: {
    title: 'Blog AXION — Panduan Akuntansi UMKM Indonesia',
    description:
      'Panduan praktis akuntansi & keuangan bisnis untuk UMKM Indonesia.',
    url: 'https://axionventura.com/blog',
    type: 'website',
  },
};

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );

  return (
    <div className="container mx-auto px-6 py-16 max-w-4xl">
      <header className="mb-12">
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3">
          Blog AXION
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-tight">
          Panduan Akuntansi & Keuangan untuk UMKM Indonesia
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
          Belajar pembukuan, laporan keuangan, dan analisis bisnis dari nol — ditulis khusus untuk pemilik UMKM Indonesia.
        </p>
      </header>

      <div className="space-y-6">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
              <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full font-semibold">
                {post.category}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {post.readingMinutes} menit baca
              </span>
              <span>
                {new Date(post.publishedAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {post.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
              {post.description}
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              Baca selengkapnya
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
