-- Migration 068: Tambah 'rss' ke daftar source yang diizinkan di market_data_cache.
-- FMP free tier tidak menyediakan endpoint news, jadi kita switch ke RSS publik
-- (Yahoo Finance, CNBC, Bloomberg, FT) sebagai sumber berita.

ALTER TABLE market_data_cache
  DROP CONSTRAINT IF EXISTS market_data_cache_source_check;

ALTER TABLE market_data_cache
  ADD CONSTRAINT market_data_cache_source_check
  CHECK (source IN ('fmp', 'fred', 'exchangerate', 'rss'));
