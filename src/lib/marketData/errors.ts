/**
 * Error class khusus untuk HTTP 429 (Too Many Requests) dari API eksternal.
 * Service layer pakai ini untuk mengaktifkan rate-limit cooldown — supaya
 * request berikut tidak ikut ke-hit dan langsung pakai stale cache.
 */
export class RateLimitError extends Error {
  readonly source: string;
  readonly retryAfterSeconds: number | null;

  constructor(source: string, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'RateLimitError';
    this.source = source;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isRateLimitError(err: unknown): err is RateLimitError {
  return err instanceof RateLimitError;
}

/**
 * Parse Retry-After header (RFC 7231): bisa berupa detik (int) atau HTTP date.
 */
export function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const asInt = parseInt(headerValue, 10);
  if (!isNaN(asInt) && asInt >= 0) return asInt;
  const asDate = Date.parse(headerValue);
  if (!isNaN(asDate)) {
    const diff = Math.floor((asDate - Date.now()) / 1000);
    return diff > 0 ? diff : null;
  }
  return null;
}
