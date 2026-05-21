import { CACHE_TTL, FRED_SERIES } from './constants';
import type { MacroSeries, MacroSeriesPoint } from './types';
import { RateLimitError, parseRetryAfter } from './errors';

const FRED_BASE = 'https://api.stlouisfed.org/fred';

function getApiKey(): string {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    throw new Error('FRED_API_KEY is not configured');
  }
  return key;
}

interface FredObservation {
  date: string;
  value: string;
}

/**
 * Fetch FRED time series + metadata.
 * Endpoints:
 *   GET /series?series_id=X&api_key=...&file_type=json
 *   GET /series/observations?series_id=X&limit=N&sort_order=desc&api_key=...&file_type=json
 */
export async function fetchSeries(
  seriesId: string,
  limit = 60
): Promise<MacroSeries> {
  const apiKey = getApiKey();

  const obsUrl =
    `${FRED_BASE}/series/observations?series_id=${encodeURIComponent(seriesId)}` +
    `&limit=${limit}&sort_order=desc&api_key=${apiKey}&file_type=json`;
  const obsRes = await fetch(obsUrl, { next: { revalidate: CACHE_TTL.FRED_SERIES } });
  if (obsRes.status === 429) {
    throw new RateLimitError(
      'fred',
      'FRED rate limit hit (HTTP 429)',
      parseRetryAfter(obsRes.headers.get('retry-after'))
    );
  }
  if (!obsRes.ok) {
    throw new Error(`FRED observations ${obsRes.status}: ${await obsRes.text()}`);
  }
  const obsJson = (await obsRes.json()) as { observations?: FredObservation[] };
  const observations: MacroSeriesPoint[] = (obsJson.observations ?? [])
    .map((o) => ({
      date: o.date,
      value: o.value === '.' ? null : Number(o.value),
    }))
    .reverse(); // oldest → newest untuk chart

  const meta = FRED_SERIES[seriesId];
  return {
    seriesId,
    title: meta?.title ?? seriesId,
    units: meta?.units ?? '',
    frequency: 'unknown',
    observations,
  };
}
