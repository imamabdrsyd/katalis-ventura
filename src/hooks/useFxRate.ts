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

  const [trackedKey, setTrackedKey] = useState(key);
  const [rate, setRate] = useState<number | null>(() => pairCache.get(key)?.rate ?? null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(() => pairCache.get(key)?.fetchedAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived state: reset rate saat key berubah supaya tidak return stale rate dari currency sebelumnya
  if (trackedKey !== key) {
    setTrackedKey(key);
    const c = pairCache.get(key);
    setRate(c?.rate ?? null);
    setFetchedAt(c?.fetchedAt ?? null);
    setError(null);
  }

  useEffect(() => {
    if (key === 'IDR') return;

    const now = Date.now();
    const hit = pairCache.get(key);
    if (hit && now - hit.ts < CACHE_TTL_MS) {
      // sudah di-apply via derived state di atas
      return;
    }

    setLoading(true);
    setError(null);
    let cancelled = false;

    fetch(`/api/market/fx?from=${key}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const r = json?.data?.rate ?? null;
        if (typeof r === 'number' && r > 0) {
          pairCache.set(key, { rate: r, fetchedAt: json?.fetchedAt ?? new Date().toISOString(), ts: Date.now() });
          setRate(r);
          setFetchedAt(json?.fetchedAt ?? null);
        } else {
          setError('Kurs tidak tersedia');
        }
      })
      .catch(() => { if (!cancelled) setError('Gagal mengambil kurs'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [key]);

  if (key === 'IDR') {
    return { rate: null, loading: false, error: null, fetchedAt: null };
  }

  return { rate, loading, error, fetchedAt };
}
