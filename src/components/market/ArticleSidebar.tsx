import { ArrowUpRight } from 'lucide-react';
import type { FmpArticle } from '@/lib/marketData/types';

interface ArticleSidebarProps {
  articles: FmpArticle[];
  limit?: number;
  title?: string;
}

export function ArticleSidebar({
  articles,
  limit = 6,
  title = 'VC, PE & UMKM Insights',
}: ArticleSidebarProps) {
  const visible = articles.slice(0, limit);

  return (
    <aside className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
        {title}
      </h3>
      {visible.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Belum ada artikel terkait
        </p>
      ) : (
        <ul className="space-y-3 flex-1 overflow-y-auto">
          {visible.map((a, idx) => (
            <li key={`${a.link}-${idx}`}>
              <a
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2 text-sm"
              >
                <ArrowUpRight className="w-3.5 h-3.5 mt-1 text-indigo-500 dark:text-indigo-400 flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                <span className="text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 leading-snug line-clamp-2">
                  {a.title}
                </span>
              </a>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-5.5 pl-0">
                {a.site}
              </p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
