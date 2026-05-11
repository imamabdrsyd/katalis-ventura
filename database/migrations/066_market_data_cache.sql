-- Migration 066: Market Data Cache
-- Server-side cache untuk data pasar eksternal (FMP, FRED, ExchangeRate-API).
-- Berbeda dari `financial_summary_cache` karena data global (tidak terikat business_id),
-- dipakai oleh halaman publik (landing, /market-insights, /blog) dan dashboard.
--
-- Strategi: cache-first dengan TTL per source. Bila external API quota habis atau
-- network error, service layer fallback ke payload terakhir (walaupun expired).

CREATE TABLE IF NOT EXISTS market_data_cache (
  cache_key TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('fmp', 'fred', 'exchangerate')),
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  fetch_status TEXT NOT NULL DEFAULT 'ok'
    CHECK (fetch_status IN ('ok', 'stale_fallback', 'error')),
  error_message TEXT,
  hit_count INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_market_data_cache_source
  ON market_data_cache (source);
CREATE INDEX IF NOT EXISTS idx_market_data_cache_expires
  ON market_data_cache (expires_at);

COMMENT ON TABLE market_data_cache IS 'Cache global untuk data pasar eksternal (FMP/FRED/ExchangeRate)';
COMMENT ON COLUMN market_data_cache.cache_key IS 'Key unik per dataset, format: {source}:{type}:{id?}';
COMMENT ON COLUMN market_data_cache.fetch_status IS 'ok=fresh, stale_fallback=external error tapi pakai cache lama, error=tidak ada cache fallback';

-- RLS: data publik, semua orang bisa baca. Write hanya via service role (admin client).
ALTER TABLE market_data_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read market cache" ON market_data_cache;
CREATE POLICY "Public can read market cache"
  ON market_data_cache FOR SELECT
  USING (true);
-- Tidak ada policy INSERT/UPDATE/DELETE → semua write WAJIB pakai createAdminClient().
