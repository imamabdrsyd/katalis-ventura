'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import * as assetApi from '@/lib/api/assetConsole';
import { disconnectVenture } from '@/lib/api/venture';
import type { AssetConsoleData } from '@/lib/api/assetConsole';
import type { AssetHolding } from '@/lib/assetConsole';

const EMPTY: AssetConsoleData = {
  holdings: [],
  summary: {
    totalInvested: 0,
    totalMarketValue: 0,
    totalUnrealizedPl: 0,
    totalUnrealizedPlPct: 0,
    totalRealizedPl: 0,
    openInstrumentCount: 0,
    missingPriceCount: 0,
  },
  instruments: [],
};

export interface UseAssetConsoleReturn extends AssetConsoleData {
  loading: boolean;
  error: string | null;
  activeBusinessId: string | null;
  refetch: () => Promise<void>;
  /** Simpan harga pasar baru lalu hitung ulang seluruh turunannya. */
  updatePrice: (itemId: string, price: number) => Promise<void>;
  /** Lepas tautan venture (soft delete baris katalognya), lalu muat ulang. */
  disconnect: (itemId: string) => Promise<void>;
  findHolding: (itemId: string) => AssetHolding | undefined;
}

export function useAssetConsole(): UseAssetConsoleReturn {
  const { activeBusinessId } = useBusinessContext();
  const [data, setData] = useState<AssetConsoleData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await assetApi.getAssetConsoleData(activeBusinessId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data Asset Console');
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [activeBusinessId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Transaksi baru (mis. lewat FloatingQuickAdd) bisa mengubah posisi — ikut
  // event yang sama dengan halaman Transaksi supaya angka tidak basi.
  useEffect(() => {
    const onSaved = () => void load();
    window.addEventListener('transaction-saved', onSaved);
    return () => window.removeEventListener('transaction-saved', onSaved);
  }, [load]);

  const updatePrice = useCallback(
    async (itemId: string, price: number) => {
      await assetApi.updateAssetLastPrice(itemId, price);
      await load();
    },
    [load]
  );

  const disconnect = useCallback(
    async (itemId: string) => {
      await disconnectVenture(itemId);
      await load();
    },
    [load]
  );

  const findHolding = useCallback(
    (itemId: string) => data.holdings.find((h) => h.itemId === itemId),
    [data.holdings]
  );

  return {
    ...data,
    loading,
    error,
    activeBusinessId: activeBusinessId ?? null,
    refetch: load,
    updatePrice,
    disconnect,
    findHolding,
  };
}
