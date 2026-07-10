'use client';

import { useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import type { FxRate, MarketResult, MarketCacheStatus } from '@/lib/marketData/types';

interface FxMiniWidgetProps {
  className?: string;
}

type FxState = { fx: FxRate | null; status: MarketCacheStatus; loading: boolean };

/**
 * Compact USD/IDR rate widget — same visual as on /market.
 * Self-fetches from /api/market/fx; renders nothing once loaded if rate unavailable.
 */
export function FxMiniWidget({ className = '' }: FxMiniWidgetProps) {
  const [state, setState] = useState<FxState>({ fx: null, status: 'ok', loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/market/fx')
      .then((r) => r.json() as Promise<MarketResult<FxRate | null>>)
      .then((res) => {
        if (cancelled) return;
        setState({ fx: res.data, status: res.status, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return (
      <div
        className={`w-40 h-[52px] rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse ${className}`}
        aria-hidden
      />
    );
  }

  if (!state.fx) return null;

  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(state.fx.rate);

  return (
    <div
      className={`flex items-center gap-2.5 bg-white dark:bg-gray-800 border border-transparent dark:border-gray-700 rounded-xl px-4 py-2.5 shadow-card ${className}`}
    >
      <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
      <div>
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-none mb-0.5">
          {state.fx.base} / {state.fx.target}
        </p>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-none">
          {formatted}
        </p>
      </div>
    </div>
  );
}
