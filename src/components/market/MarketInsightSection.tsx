'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FxTickerCard } from './FxTickerCard';
import { StockNewsGrid } from './StockNewsGrid';
import type {
  FxRate,
  StockNews,
  MarketResult,
  MarketCacheStatus,
} from '@/lib/marketData/types';

/**
 * Section "Market Insight" untuk landing page (/).
 * Client component karena landing page sendiri sudah 'use client'.
 * Fetch data dari /api/market/* yang internally cache via Supabase.
 */
export function MarketInsightSection() {
  const [fx, setFx] = useState<FxRate | null>(null);
  const [fxStatus, setFxStatus] = useState<MarketCacheStatus>('ok');
  const [news, setNews] = useState<StockNews[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [fxRes, newsRes] = await Promise.all([
          fetch('/api/market/fx').then((r) => r.json() as Promise<MarketResult<FxRate | null>>),
          fetch('/api/market/news?type=stock').then((r) => r.json() as Promise<MarketResult<StockNews[]>>),
        ]);
        if (cancelled) return;
        setFx(fxRes.data);
        setFxStatus(fxRes.status);
        setNews(newsRes.data);
      } catch {
        // Silent — UI akan show empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="container mx-auto px-6 py-16">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
            Market Insight
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
            Pulse pasar global, ringkas dalam satu glance.
          </h2>
        </div>
        <Link
          href="/market-insights"
          className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:gap-3 transition-all"
        >
          Lihat selengkapnya
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <FxTickerCard data={fx} status={fxStatus} />
        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Konteks
          </p>
          <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
            Setiap keputusan investasi butuh context — kurs valuta, suku bunga global,
            dan sentimen berita. AXION mengagregasi data terbaru dari Reuters, CNBC,
            FRED, dan ExchangeRate-API supaya kamu tetap up-to-date tanpa harus buka 5 tab.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-72 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <StockNewsGrid items={news} limit={4} />
      )}
    </section>
  );
}
