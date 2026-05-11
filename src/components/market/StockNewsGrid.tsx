import { ExternalLink, Clock } from 'lucide-react';
import type { StockNews } from '@/lib/marketData/types';

interface StockNewsGridProps {
  items: StockNews[];
  limit?: number;
  emptyMessage?: string;
  columns?: 2 | 3 | 4;
}

const COLUMN_CLASSES: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function StockNewsGrid({
  items,
  limit = 4,
  emptyMessage = 'Berita pasar belum tersedia',
  columns = 4,
}: StockNewsGridProps) {
  const visible = items.slice(0, limit);

  if (visible.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`grid ${COLUMN_CLASSES[columns]} gap-4`}>
      {visible.map((item, idx) => (
        <a
          key={`${item.url}-${idx}`}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all overflow-hidden"
        >
          {item.image ? (
            // Pakai img native, bukan next/image — gambar dari domain eksternal arbitrer
            // tidak ter-allowlist di next.config; cukup loading lazy untuk performa.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt=""
              loading="lazy"
              className="w-full h-40 object-cover bg-gray-100 dark:bg-gray-900"
            />
          ) : (
            <div className="w-full h-40 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/40 dark:to-indigo-800/40" />
          )}
          <div className="p-4 flex-1 flex flex-col">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                {item.site}
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                <Clock className="w-3 h-3" />
                {formatRelativeDate(item.publishedDate)}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug mb-2 line-clamp-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {item.title}
            </h3>
            <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 pt-2">
              Baca selengkapnya
              <ExternalLink className="w-3 h-3" />
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
