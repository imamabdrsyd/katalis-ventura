// TTL dalam detik per cache key
export const CACHE_TTL = {
  RSS_STOCK_NEWS: 30 * 60,           // 30 menit
  RSS_GENERAL_ARTICLES: 60 * 60,     // 1 jam
  FRED_SERIES: 24 * 60 * 60,         // 24 jam
  EXCHANGE_RATE: 60 * 60,            // 1 jam
} as const;

export const CACHE_KEYS = {
  rssStockNews: 'rss:stock_news:latest',
  rssVcPeSme: 'rss:articles:vc-pe-sme',
  fxUsdIdr: 'fx:usd_idr',
  fredSeries: (id: string) => `fred:series:${id}`,
} as const;

// Series FRED yang tersedia di Macro Tracker
export interface FredSeriesMeta {
  id: string;
  title: string;
  units: string;
  description: string;
}

export const FRED_SERIES: Record<string, FredSeriesMeta> = {
  FEDFUNDS: {
    id: 'FEDFUNDS',
    title: 'Federal Funds Rate (US)',
    units: '%',
    description: 'Suku bunga acuan The Fed (rata-rata bulanan)',
  },
  CPIAUCSL: {
    id: 'CPIAUCSL',
    title: 'US CPI (Inflasi)',
    units: 'Index',
    description: 'Consumer Price Index, All Urban Consumers',
  },
  DGS10: {
    id: 'DGS10',
    title: '10-Year Treasury Yield',
    units: '%',
    description: 'Yield obligasi pemerintah AS tenor 10 tahun',
  },
  DEXIDUS: {
    id: 'DEXIDUS',
    title: 'Indonesia / US Foreign Exchange Rate',
    units: 'IDR/USD',
    description: 'Kurs IDR terhadap USD (harian)',
  },
};

export const DEFAULT_FRED_SERIES = 'FEDFUNDS';
