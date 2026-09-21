import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { getCollectionIndexContent } from '@/lib/site/server';
import { getPostSummaries } from '@/lib/site/posts';

/**
 * Indeks /blog.
 *
 * Daftarnya MENGGABUNGKAN dua sumber: artikel yang masih hidup di kode
 * (`src/lib/blog/posts.ts`) dan artikel dari CMS (`site_posts`). Lihat catatan di
 * `src/lib/site/posts.ts` soal kenapa artikel lama tidak dipindahkan — body-nya
 * JSX bespoke yang sudah terindeks Google.
 *
 * Bagi pembaca kedua sumber itu tidak terlihat bedanya; kartunya identik.
 */
const pageUrl = 'https://axionventura.com/blog';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const content = await getCollectionIndexContent('blog_index');

  return {
    title: content.seo.title,
    description: content.seo.description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: content.seo.title,
      description: content.seo.description,
      url: pageUrl,
      type: 'website',
    },
  };
}

export default async function BlogIndexPage() {
  const [content, posts] = await Promise.all([
    getCollectionIndexContent('blog_index'),
    getPostSummaries('blog'),
  ]);

  return (
    <div className="container mx-auto px-6 py-16 max-w-4xl">
      <header className="mb-12">
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3">
          {content.eyebrow}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-tight">
          {content.title}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl">{content.lead}</p>
      </header>

      {posts.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">Belum ada artikel.</p>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                {post.category && (
                  <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full font-semibold">
                    {post.category}
                  </span>
                )}
                {post.readingMinutes > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {post.readingMinutes} menit baca
                  </span>
                )}
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
      )}
    </div>
  );
}
