'use client';

import { useState, useEffect } from 'react';

interface FxRateResult {
  rate: number | null;
  loading: boolean;
  error: string | null;
  fetchedAt: string | null;
}

const pairCache = new Map<string, { rate: number; fetchedAt: string; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit in-memory

/**
 * Fetch kurs {currencyCode}→IDR dari /api/market/fx.
 * Support semua currency di SUPPORTED_CURRENCIES kecuali IDR sendiri.
 */
export function useFxRate(currencyCode: string): FxRateResult {
  const key = currencyCode.toUpperCase();
  const cached = pairCache.get(key);

  const [rate, setRate] = useState<number | null>(cached?.rate ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(cached?.fetchedAt ?? null);

  useEffect(() => {
    if (key === 'IDR') return;

    const now = Date.now();
    const hit = pairCache.get(key);
    if (hit && now - hit.ts < CACHE_TTL_MS) {
      setRate(hit.rate);
      setFetchedAt(hit.fetchedAt);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/market/fx?from=${key}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const r = json?.data?.rate ?? null;
        if (typeof r === 'number' && r > 0) {
          pairCache.set(key, { rate: r, fetchedAt: json?.fetchedAt ?? new Date().toISOString(), ts: Date.now() });
          setRate(r);
          setFetchedAt(json?.fetchedAt ?? null);
        } else {
          setError('Kurs tidak tersedia');
        }
      })
      .catch(() => setError('Gagal mengambil kurs'))
      .finally(() => setLoading(false));
  }, [key]);

  if (key === 'IDR') {
    return { rate: null, loading: false, error: null, fetchedAt: null };
  }

  return { rate, loading, error, fetchedAt };
}
