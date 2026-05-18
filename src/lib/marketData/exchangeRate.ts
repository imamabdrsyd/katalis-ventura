import type { FxRate } from './types';
import { RateLimitError, parseRetryAfter } from './errors';

function getApiKey(): string {
  const key = process.env.EXCHANGERATE_API_KEY;
  if (!key) {
    throw new Error('EXCHANGERATE_API_KEY is not configured');
  }
  return key;
}

interface PairResponse {
  result: string;
  conversion_rate?: number;
  time_last_update_utc?: string;
  'error-type'?: string;
}

/**
 * Fetch kurs {from} → IDR dari ExchangeRate-API.
 * Endpoint: GET /v6/{API_KEY}/pair/{from}/IDR
 * Free tier: 1500 req/month — tiap currency pair = 1 request terpisah.
 */
export async function fetchFxPair(from: string, to = 'IDR'): Promise<FxRate> {
  const url = `https://v6.exchangerate-api.com/v6/${getApiKey()}/pair/${from}/${to}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 429) {
    throw new RateLimitError(
      'exchangerate',
      'ExchangeRate-API rate limit hit (HTTP 429)',
      parseRetryAfter(res.headers.get('retry-after'))
    );
  }
  if (!res.ok) {
    throw new Error(`ExchangeRate ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as PairResponse;
  if (json.result !== 'success' || typeof json.conversion_rate !== 'number') {
    if (json['error-type'] === 'quota-reached') {
      throw new RateLimitError('exchangerate', 'ExchangeRate-API quota reached');
    }
    throw new Error(`ExchangeRate failed: ${json['error-type'] ?? 'unknown'}`);
  }
  return {
    base: from,
    target: to,
    rate: json.conversion_rate,
    fetchedAt: json.time_last_update_utc ?? new Date().toISOString(),
  };
}

/** @deprecated Gunakan fetchFxPair('USD') */
export const fetchUsdIdr = () => fetchFxPair('USD', 'IDR');
