import type { Metadata } from 'next';
import {
  getFxRate,
  getMacroSeries,
  getStockNews,
  getVcPeSmeArticles,
} from '@/lib/marketData/service';
import { DEFAULT_FRED_SERIES } from '@/lib/marketData/constants';
import { FxTickerCard } from '@/components/market/FxTickerCard';
import { StockNewsGrid } from '@/components/market/StockNewsGrid';
import { MacroTrackerSection } from '@/components/market/MacroTrackerSection';
import { ArticleSidebar } from '@/components/market/ArticleSidebar';

export const metadata: Metadata = {
  title: 'Market Insights — AXION | VC, PE & Macro Data untuk Indonesia',
  description:
    'Pulse pasar global, makroekonomi (suku bunga The Fed, inflasi, kurs USD/IDR), dan berita Venture Capital, Private Equity, dan UMKM Indonesia — semua dalam satu halaman.',
  alternates: { canonical: 'https://axionventura.com/market-insights' },
  openGraph: {
    title: 'Market Insights — AXION',
    description:
      'Data pasar, makroekonomi, dan berita VC/PE/UMKM untuk family office & investor Indonesia.',
    url: 'https://axionventura.com/market-insights',
    type: 'website',
  },
};

// Server Component — di-render di server tiap request, mengandalkan cache layer
// di service.ts untuk membatasi external API calls. Revalidate ringan dari Next
// supaya HTML bisa di-cache di edge bila tidak ada perubahan data.
export const revalidate = 600; // 10 menit

export default async function MarketInsightsPage() {
  const [fxResult, newsResult, articlesResult, macroResult] = await Promise.all([
    getFxRate(),
    getStockNews(),
    getVcPeSmeArticles(),
    getMacroSeries(DEFAULT_FRED_SERIES),
  ]);

  return (
    <div className="container mx-auto px-6 py-12 max-w-6xl">
      <header className="mb-10 max-w-3xl">
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3">
          Market Insights
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-tight">
          Market & Macro Insights for Indonesian Investors
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Kurs, suku bunga global, inflasi, dan berita keuangan terbaru — diagregasi
          dari Reuters, CNBC, FRED, dan ExchangeRate-API agar setiap keputusan
          investasi punya konteks data yang up-to-date.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-1">
          <FxTickerCard data={fxResult.data} status={fxResult.status} size="lg" />
        </div>
        <div className="lg:col-span-2">
          <MacroTrackerSection
            initialSeries={macroResult.data}
            initialSeriesId={DEFAULT_FRED_SERIES}
          />
        </div>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Berita Pasar Saham Terbaru
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Sumber: Yahoo Finance, CNBC, Bloomberg · diperbarui setiap 30 menit
        </p>
        <StockNewsGrid items={newsResult.data} limit={8} />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          VC, PE & UMKM
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Artikel terkurasi seputar Venture Capital, Private Equity, dan UMKM Indonesia
        </p>
        <div className="max-w-2xl">
          <ArticleSidebar
            articles={articlesResult.data}
            limit={10}
            title="Artikel Pilihan"
          />
        </div>
      </section>
    </div>
  );
}
