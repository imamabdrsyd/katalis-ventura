'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { FxTickerCard } from '@/components/market/FxTickerCard';
import { StockNewsGrid } from '@/components/market/StockNewsGrid';
import { ArticleSidebar } from '@/components/market/ArticleSidebar';
import { DEFAULT_FRED_SERIES } from '@/lib/marketData/constants';
import type {
  FxRate,
  StockNews,
  FmpArticle,
  MacroSeries,
  MarketResult,
  MarketCacheStatus,
} from '@/lib/marketData/types';

const MacroTrackerSection = dynamic(
  () => import('@/components/market/MacroTrackerSection').then((m) => m.MacroTrackerSection),
  { ssr: false }
);

interface MarketState {
  fx: FxRate | null;
  fxStatus: MarketCacheStatus;
  news: StockNews[];
  articles: FmpArticle[];
  macro: MacroSeries | null;
  loading: boolean;
}

export default function MarketDashboardPage() {
  const [state, setState] = useState<MarketState>({
    fx: null,
    fxStatus: 'ok',
    news: [],
    articles: [],
    macro: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [fxRes, newsRes, articlesRes, macroRes] = await Promise.all([
          fetch('/api/market/fx').then((r) => r.json() as Promise<MarketResult<FxRate | null>>),
          fetch('/api/market/news?type=stock').then((r) => r.json() as Promise<MarketResult<StockNews[]>>),
          fetch('/api/market/news?type=articles').then((r) => r.json() as Promise<MarketResult<FmpArticle[]>>),
          fetch(`/api/market/macro?series=${DEFAULT_FRED_SERIES}`).then(
            (r) => r.json() as Promise<MarketResult<MacroSeries | null>>
          ),
        ]);
        if (cancelled) return;
        setState({
          fx: fxRes.data,
          fxStatus: fxRes.status,
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
      <header className="mb-6">
        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
          Market Tracker
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
          Pulse pasar global hari ini
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Kurs valuta, makroekonomi, dan berita keuangan terbaru.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-1">
          {state.loading ? (
            <div className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ) : (
            <FxTickerCard data={state.fx} status={state.fxStatus} size="lg" />
          )}
        </div>
        <div className="lg:col-span-2">
          {state.loading ? (
            <div className="h-96 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ) : (
            <MacroTrackerSection
              initialSeries={state.macro}
              initialSeriesId={DEFAULT_FRED_SERIES}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
            Berita Pasar Saham
          </h2>
          {state.loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-72 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <StockNewsGrid items={state.news} limit={6} columns={2} />
          )}
        </div>
        <div className="lg:col-span-1">
          <ArticleSidebar articles={state.articles} limit={8} />
        </div>
      </div>
    </div>
  );
}
