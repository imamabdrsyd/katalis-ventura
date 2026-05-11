import { createAdminClient } from '@/lib/supabase-server';
import type {
  MarketCacheRow,
  MarketDataSource,
  MarketCacheStatus,
} from './types';

/**
 * Ambil row cache by key. Pakai admin client supaya konsisten dengan write path
 * (server-side only). RLS sebenarnya sudah allow public read, tapi pakai admin
 * client lebih simple di Server Component / Route Handler.
 */
export async function getMarketCache<T = unknown>(
  cacheKey: string
): Promise<MarketCacheRow<T> | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('market_data_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error) {
    console.error('[market_cache] read error', cacheKey, error.message);
    return null;
  }
  return (data as MarketCacheRow<T> | null) ?? null;
}

export function isFresh(row: MarketCacheRow | null): boolean {
  if (!row) return false;
  return new Date(row.expires_at).getTime() > Date.now();
}

/**
 * Upsert payload baru ke cache. WAJIB pakai admin client karena tidak ada
 * RLS write policy untuk publik.
 */
export async function upsertMarketCache<T>(params: {
  cacheKey: string;
  source: MarketDataSource;
  payload: T;
  ttlSeconds: number;
  status?: MarketCacheStatus;
  errorMessage?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + params.ttlSeconds * 1000);

  const { error } = await supabase
    .from('market_data_cache')
    .upsert(
      {
        cache_key: params.cacheKey,
        source: params.source,
        payload: params.payload as unknown,
        fetched_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        fetch_status: params.status ?? 'ok',
        error_message: params.errorMessage ?? null,
      },
      { onConflict: 'cache_key' }
    );

  if (error) {
    console.error('[market_cache] write error', params.cacheKey, error.message);
  }
}

/**
 * Tandai cache existing sebagai stale_fallback (external API gagal, kita masih
 * pakai payload lama). Tidak menyentuh expires_at — supaya next call mencoba
 * refetch lagi, tapi UI bisa show banner "cached".
 */
export async function markCacheStale(
  cacheKey: string,
  errorMessage: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('market_data_cache')
    .update({
      fetch_status: 'stale_fallback',
      error_message: errorMessage.slice(0, 500),
    })
    .eq('cache_key', cacheKey);

  if (error) {
    console.error('[market_cache] mark stale error', cacheKey, error.message);
  }
}

/**
 * Geser `expires_at` ke depan oleh cooldownSec — dipakai saat external API
 * return 429 supaya request berikut tidak ikut ke-rate-limited dan langsung
 * pakai cached payload selama cooldown window.
 */
export async function extendCacheExpiry(
  cacheKey: string,
  cooldownSec: number
): Promise<void> {
  const supabase = createAdminClient();
  const newExpiry = new Date(Date.now() + cooldownSec * 1000).toISOString();
  const { error } = await supabase
    .from('market_data_cache')
    .update({ expires_at: newExpiry })
    .eq('cache_key', cacheKey);
  if (error) {
    console.error('[market_cache] extend expiry error', cacheKey, error.message);
  }
}

/**
 * Best-effort increment hit_count untuk telemetri. Tidak fail kalau error.
 */
export async function incrementHitCount(cacheKey: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('market_data_cache')
    .select('hit_count')
    .eq('cache_key', cacheKey)
    .maybeSingle();
  if (!data) return;
  await supabase
    .from('market_data_cache')
    .update({ hit_count: (data.hit_count ?? 0) + 1 })
    .eq('cache_key', cacheKey);
}
