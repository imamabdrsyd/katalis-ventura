import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Calendar, Clock } from 'lucide-react';
import { ContentBlocks } from '@/components/legal/ContentBlocks';
import { getPostLocale, getPublishedPost } from '@/lib/site/posts';

/**
 * Halaman artikel /blog/[slug] untuk artikel yang dikelola CMS.
 *
 * Artikel yang masih hidup di kode punya route statisnya sendiri
 * (`app/blog/cara-buat-laporan-laba-rugi-umkm/page.tsx`). Route statis menang
 * atas `[slug]` di Next.js, jadi keduanya bisa hidup bersama tanpa saling
 * menutupi — dan route admin menolak slug yang sudah dipakai artikel kode
 * (`isCodePostSlug`), supaya tidak ada artikel CMS yang tak pernah bisa dibuka.
 *
 * Struktur, tipografi, dan JSON-LD-nya dibuat mengikuti artikel kode supaya
 * pembaca maupun crawler tidak melihat bedanya.
 */

const baseUrl = 'https://axionventura.com';

export const revalidate = 3600;

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost('blog', slug);
  const localized = post ? getPostLocale(post) : null;

  if (!post || !localized) return { title: 'Artikel tidak ditemukan' };

  const url = `${baseUrl}/blog/${slug}`;

  return {
    title: localized.title,
    description: localized.excerpt,
    keywords: post.content.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: localized.title,
      description: localized.excerpt,
      url,
      type: 'article',
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: post.content.author ? [post.content.author] : undefined,
      tags: post.content.keywords,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: localized.title,
      description: localized.excerpt,
    },
  };
}

export default async function CmsArticlePage({ params }: RouteParams) {
  const { slug } = await params;
  const post = await getPublishedPost('blog', slug);
  const localized = post ? getPostLocale(post) : null;

  // Artikel draft, slug tak dikenal, atau artikel tanpa isi di bahasa mana pun
  // sama-sama 404 — status draft tidak boleh bisa diintip dari luar.
  if (!post || !localized) notFound();

  const url = `${baseUrl}/blog/${slug}`;
  const publishedAt = post.publishedAt ?? post.updatedAt;

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: localized.title,
    description: localized.excerpt,
    author: {
      '@type': 'Organization',
      name: post.content.author || 'Tim AXION',
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'AXION',
      logo: { '@type': 'ImageObject', url: `${baseUrl}/images/axion.png` },
    },
    datePublished: publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'id-ID',
    keywords: post.content.keywords.join(', '),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <article className="container mx-auto px-6 py-12 max-w-3xl">
        <nav className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          <Link href="/blog" className="hover:text-indigo-600 dark:hover:text-indigo-400">
            Blog
          </Link>
          {post.content.category && (
            <>
              <span className="mx-2">/</span>
              <span>{post.content.category}</span>
            </>
          )}
        </nav>

        <header className="mb-10">
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-4">
            {post.content.category && (
              <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full font-semibold">
                {post.content.category}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(publishedAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            {post.content.readingMinutes > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {post.content.readingMinutes} menit baca
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 leading-tight mb-4">
            {localized.title}
          </h1>

          {localized.excerpt && (
            <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              {localized.excerpt}
            </p>
          )}

          {post.coverImageUrl && (
            <Image
              src={post.coverImageUrl}
              alt={localized.title}
              width={1200}
              height={675}
              priority
              className="mt-8 h-auto w-full rounded-2xl border border-gray-200 dark:border-gray-700"
            />
          )}
        </header>

        <div className="space-y-4 text-base leading-relaxed text-gray-600 dark:text-gray-300">
          <ContentBlocks blocks={localized.body} />
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/blog"
            className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            ← Kembali ke Blog
          </Link>
        </div>
      </article>
    </>
  );
}
