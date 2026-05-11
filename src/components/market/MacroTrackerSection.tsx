'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { LineChart } from 'lucide-react';
import { FRED_SERIES, DEFAULT_FRED_SERIES } from '@/lib/marketData/constants';
import type { MacroSeries, MarketResult } from '@/lib/marketData/types';

const MacroChart = dynamic(() => import('./MacroChart'), { ssr: false });

interface MacroTrackerSectionProps {
  initialSeries: MacroSeries | null;
  initialSeriesId?: string;
}

export function MacroTrackerSection({
  initialSeries,
  initialSeriesId = DEFAULT_FRED_SERIES,
}: MacroTrackerSectionProps) {
  const [seriesId, setSeriesId] = useState<string>(initialSeriesId);
  const [series, setSeries] = useState<MacroSeries | null>(initialSeries);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (seriesId === initialSeriesId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/market/macro?series=${encodeURIComponent(seriesId)}`)
      .then((res) => res.json())
      .then((result: MarketResult<MacroSeries | null>) => {
        if (!cancelled) setSeries(result.data);
      })
      .catch(() => {
        if (!cancelled) setSeries(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [seriesId, initialSeriesId]);

  const meta = FRED_SERIES[seriesId];

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <LineChart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Macro Tracker
            </p>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {meta?.title ?? seriesId}
            </h3>
            {meta?.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {meta.description}
              </p>
            )}
          </div>
        </div>
        <select
          value={seriesId}
          onChange={(e) => setSeriesId(e.target.value)}
          className="text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {Object.values(FRED_SERIES).map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-80">
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-sm text-gray-400">Memuat data...</div>
          </div>
        ) : (
          <MacroChart series={series} />
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
        Sumber: Federal Reserve Economic Data (FRED), St. Louis Fed
      </p>
    </div>
  );
}
