'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { StockNewsGrid } from '@/components/market/StockNewsGrid';
import { ArticleSidebar } from '@/components/market/ArticleSidebar';
import { FxMiniWidget } from '@/components/market/FxMiniWidget';
import { DEFAULT_FRED_SERIES } from '@/lib/marketData/constants';
import type {
  StockNews,
  FmpArticle,
  MacroSeries,
  MarketResult,
} from '@/lib/marketData/types';

const MacroTrackerSection = dynamic(
  () => import('@/components/market/MacroTrackerSection').then((m) => m.MacroTrackerSection),
  { ssr: false }
);

interface MarketState {
  news: StockNews[];
  articles: FmpArticle[];
  macro: MacroSeries | null;
  loading: boolean;
}

export default function MarketDashboardPage() {
  const [state, setState] = useState<MarketState>({
    news: [],
    articles: [],
    macro: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [newsRes, articlesRes, macroRes] = await Promise.all([
          fetch('/api/market/news?type=stock').then((r) => r.json() as Promise<MarketResult<StockNews[]>>),
          fetch('/api/market/news?type=articles').then((r) => r.json() as Promise<MarketResult<FmpArticle[]>>),
          fetch(`/api/market/macro?series=${DEFAULT_FRED_SERIES}`).then(
            (r) => r.json() as Promise<MarketResult<MacroSeries | null>>
          ),
        ]);
        if (cancelled) return;
        setState({
          news: newsRes.data,
          articles: articlesRes.data,
          macro: macroRes.data,
          loading: false,
        });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header + FX widget sejajar */}
      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
            Market Tracker
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Pulse pasar global hari ini
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kurs valuta, makroekonomi, dan berita keuangan terbaru.
          </p>
        </div>

        <FxMiniWidget className="flex-shrink-0 mt-1" />
      </header>

      {/* Macro Tracker (lebih lebar) + VC PE UMKM Insights — grid 5 kolom */}
      {/* min-h-[490px] match tinggi aktual MacroTrackerSection (header ~100px + chart min-h-80 + padding + footer) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6 items-stretch min-h-[490px]">
        <div className="lg:col-span-3">
          {state.loading ? (
            <div className="h-full rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ) : (
            <MacroTrackerSection
              initialSeries={state.macro}
              initialSeriesId={DEFAULT_FRED_SERIES}
            />
          )}
        </div>
        <div className="lg:col-span-2">
          {state.loading ? (
            <div className="h-full rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ) : (
            <ArticleSidebar articles={state.articles} limit={10} />
          )}
        </div>
      </div>

      {/* Berita Pasar Saham — full width */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          Berita Pasar Saham
        </h2>
        {state.loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              // h-80 match tinggi aktual kartu (aspect-video image ~200px + konten ~120px)
              <div key={i} className="h-80 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <StockNewsGrid items={state.news} limit={9} columns={3} />
        )}
      </section>
    </div>
  );
}
