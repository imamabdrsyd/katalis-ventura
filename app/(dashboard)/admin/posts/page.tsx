'use client';

/**
 * Panel blog & market insights.
 *
 * Tiga hal dikelola dari satu halaman lewat tab, karena ketiganya soal halaman
 * yang sama dan admin sering bergantian antara menulis artikel dan merapikan
 * kepala halamannya.
 *
 * Tab Navigation (3 opsi, ganti tampilan) — pola kanonik DESIGN_SYSTEM §3,
 * bukan Segmented Toggle yang untuk 2–3 nilai setara.
 */

import { useState } from 'react';
import { PostsManager } from '@/components/admin/PostsManager';
import { CollectionIndexEditor } from '@/components/admin/CollectionIndexEditor';

const TABS = [
  { key: 'posts', label: 'Artikel Blog' },
  { key: 'blog_index', label: 'Kepala /blog' },
  { key: 'market_insights', label: 'Kepala /market-insights' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AdminPostsPage() {
  const [tab, setTab] = useState<TabKey>('posts');

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6 inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              tab === key
                ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'posts' && <PostsManager collection="blog" />}
      {tab === 'blog_index' && <CollectionIndexEditor pageKey="blog_index" />}
      {tab === 'market_insights' && <CollectionIndexEditor pageKey="market_insights" />}
    </div>
  );
}
