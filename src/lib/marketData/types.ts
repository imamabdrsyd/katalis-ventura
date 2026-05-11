export type MarketDataSource = 'fmp' | 'fred' | 'exchangerate' | 'rss';

export type MarketCacheStatus = 'ok' | 'stale_fallback' | 'error';

export interface MarketCacheRow<TPayload = unknown> {
  cache_key: string;
  source: MarketDataSource;
  payload: TPayload;
  fetched_at: string;
  expires_at: string;
  fetch_status: MarketCacheStatus;
  error_message: string | null;
  hit_count: number;
}

export interface StockNews {
  symbol?: string | null;
  publishedDate: string;
  title: string;
  image?: string | null;
  site: string;
  text: string;
  url: string;
}

export interface FmpArticle {
  title: string;
  date: string;
  content: string;
  tickers?: string | null;
  image?: string | null;
  link: string;
  author?: string | null;
  site: string;
}

export interface MacroSeriesPoint {
  date: string;
  value: number | null;
}

export interface MacroSeries {
  seriesId: string;
  title: string;
  units: string;
  frequency: string;
  observations: MacroSeriesPoint[];
}

export interface FxRate {
  base: string;
  target: string;
  rate: number;
  fetchedAt: string;
}

export interface MarketResult<T> {
  data: T;
  status: MarketCacheStatus;
  fetchedAt: string;
}
