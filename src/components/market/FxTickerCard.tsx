import { TrendingUp } from 'lucide-react';
import type { FxRate, MarketCacheStatus } from '@/lib/marketData/types';

interface FxTickerCardProps {
  data: FxRate | null;
  status: MarketCacheStatus;
  size?: 'sm' | 'lg';
}

export function FxTickerCard({ data, status, size = 'sm' }: FxTickerCardProps) {
  const isLg = size === 'lg';

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Kurs USD/IDR belum tersedia
        </p>
      </div>
    );
  }

  const formattedRate = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(data.rate);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
        <TrendingUp className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
          {data.base} → {data.target}
        </p>
        <p className={`font-bold text-gray-900 dark:text-gray-100 truncate ${isLg ? 'text-3xl' : 'text-xl'}`}>
          {formattedRate}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {status === 'stale_fallback' ? 'Cached (data terakhir)' : 'Per 1 USD'}
        </p>
      </div>
    </div>
  );
}
