import { CACHE_KEYS, CACHE_TTL } from './constants';
import {
  getMarketCache,
  isFresh,
  upsertMarketCache,
  markCacheStale,
  incrementHitCount,
  extendCacheExpiry,
} from './cache';
import { fetchStockNewsRss, fetchVcPeSmeArticlesRss } from './rss';
import { fetchSeries } from './fred';
import { fetchUsdIdr } from './exchangeRate';
import { isRateLimitError } from './errors';
import type {
  StockNews,
  FmpArticle,
  MacroSeries,
  FxRate,
  MarketResult,
  MarketDataSource,
} from './types';

/**
 * Default cooldown window saat hit 429 — supaya request berikut tidak langsung
 * coba refetch dan ikut ke-block. Service akan return cached payload (kalau
 * ada) atau fallback selama window ini.
 */
const RATE_LIMIT_COOLDOWN_SEC = 60 * 60; // 1 jam

/**
 * Pola umum: cache-first dengan graceful degradation.
 * 1. Ada cache fresh? → return langsung.
 * 2. Cache stale / tidak ada → fetch external API.
 *    a. Sukses → upsert cache, return.
 *    b. Gagal → kalau ada cache lama, mark stale dan return cache itu.
 *    c. Gagal & no cache → return fallback (empty data) dengan status 'error'.
 */
async function cacheFirst<T>(params: {
  cacheKey: string;
  source: MarketDataSource;
  ttlSeconds: number;
  fetcher: () => Promise<T>;
  fallback: T;
}): Promise<MarketResult<T>> {
  const cached = await getMarketCache<T>(params.cacheKey);

  if (isFresh(cached) && cached) {
    void incrementHitCount(params.cacheKey);
    return {
      data: cached.payload,
      status: cached.fetch_status,
      fetchedAt: cached.fetched_at,
    };
  }

  try {
    const fresh = await params.fetcher();
    await upsertMarketCache({
      cacheKey: params.cacheKey,
      source: params.source,
      payload: fresh,
      ttlSeconds: params.ttlSeconds,
      status: 'ok',
    });
    return {
      data: fresh,
      status: 'ok',
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const rateLimitCooldown = isRateLimitError(err)
      ? (err.retryAfterSeconds ?? RATE_LIMIT_COOLDOWN_SEC)
      : null;

    if (rateLimitCooldown !== null) {
      console.warn(`[market_data] RATE LIMIT ${params.cacheKey}: ${msg}`);
    } else {
      console.warn(`[market_data] fetch failed ${params.cacheKey}:`, msg);
    }

    if (cached) {
      // Saat 429: extend expires_at supaya request berikut tidak ikut hit external
      // API. Tanpa ini, tiap visitor berikut akan retry dan ikut ke-block.
      if (rateLimitCooldown !== null) {
        await extendCacheExpiry(params.cacheKey, rateLimitCooldown);
      }
      await markCacheStale(params.cacheKey, msg);
      return {
        data: cached.payload,
        status: 'stale_fallback',
        fetchedAt: cached.fetched_at,
      };
    }

    // Tidak ada cache — write empty fallback dengan status='error', dan kalau
    // 429 set expires_at jauh ke depan supaya request berikut tidak terus hit API.
    if (rateLimitCooldown !== null) {
      await upsertMarketCache({
        cacheKey: params.cacheKey,
        source: params.source,
        payload: params.fallback,
        ttlSeconds: rateLimitCooldown,
        status: 'error',
        errorMessage: `RATE_LIMIT: ${msg}`,
      });
    }

    return {
      data: params.fallback,
      status: 'error',
      fetchedAt: new Date().toISOString(),
    };
  }
}

export function getStockNews(): Promise<MarketResult<StockNews[]>> {
  return cacheFirst<StockNews[]>({
    cacheKey: CACHE_KEYS.rssStockNews,
    source: 'rss',
    ttlSeconds: CACHE_TTL.RSS_STOCK_NEWS,
    fetcher: () => fetchStockNewsRss(12),
    fallback: [],
  });
}

export function getVcPeSmeArticles(): Promise<MarketResult<FmpArticle[]>> {
  return cacheFirst<FmpArticle[]>({
    cacheKey: CACHE_KEYS.rssVcPeSme,
    source: 'rss',
    ttlSeconds: CACHE_TTL.RSS_GENERAL_ARTICLES,
    fetcher: () => fetchVcPeSmeArticlesRss(20),
    fallback: [],
  });
}

export function getMacroSeries(seriesId: string): Promise<MarketResult<MacroSeries | null>> {
  return cacheFirst<MacroSeries | null>({
    cacheKey: CACHE_KEYS.fredSeries(seriesId),
    source: 'fred',
    ttlSeconds: CACHE_TTL.FRED_SERIES,
    fetcher: () => fetchSeries(seriesId),
    fallback: null,
  });
}

export function getFxRate(): Promise<MarketResult<FxRate | null>> {
  return cacheFirst<FxRate | null>({
    cacheKey: CACHE_KEYS.fxUsdIdr,
    source: 'exchangerate',
    ttlSeconds: CACHE_TTL.EXCHANGE_RATE,
    fetcher: () => fetchUsdIdr(),
    fallback: null,
  });
}
