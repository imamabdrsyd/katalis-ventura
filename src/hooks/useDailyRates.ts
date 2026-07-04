'use client';

/**
 * Hook kalender harga: memuat override harga (unit_daily_rates) untuk rentang
 * grid yang tampak + menyediakan aksi set/reset harga per kumpulan tanggal.
 * Harga final per tanggal diresolve via lib murni `@/lib/rates`.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import type { CatalogItem, UnitDailyRate } from '@/types';
import { getDailyRates, upsertDailyRates, deleteDailyRates } from '@/lib/api/dailyRates';
import { buildOverrideMap, resolveNightPrice, type NightRate } from '@/lib/rates';

interface UseDailyRatesArgs {
  businessId: string;
  userId: string;
  rateItem: CatalogItem | null; // item sumber harga (calendar_rate_item_id)
  gridStart: Date;
  gridEnd: Date; // eksklusif
}

export function useDailyRates({ businessId, userId, rateItem, gridStart, gridEnd }: UseDailyRatesArgs) {
  const [overrides, setOverrides] = useState<UnitDailyRate[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!rateItem) {
      setOverrides([]);
      return;
    }
    setLoading(true);
    try {
      const from = format(gridStart, 'yyyy-MM-dd');
      const to = format(gridEnd, 'yyyy-MM-dd');
      setOverrides(await getDailyRates(rateItem.id, from, to));
    } catch {
      setOverrides([]);
    } finally {
      setLoading(false);
    }
  }, [rateItem, gridStart, gridEnd]);

  useEffect(() => {
    reload();
  }, [reload]);

  const overrideMap = useMemo(
    () => buildOverrideMap(overrides.map((o) => ({ date: o.date, price: Number(o.price) }))),
    [overrides]
  );

  /** Harga final untuk satu tanggal grid; null bila item sumber belum dipilih. */
  const priceOf = useCallback(
    (dateISO: string): NightRate | null => {
      if (!rateItem) return null;
      return resolveNightPrice(dateISO, Number(rateItem.default_price), overrideMap);
    },
    [rateItem, overrideMap]
  );

  const setPrices = useCallback(
    async (dates: string[], price: number) => {
      if (!rateItem) throw new Error('Item sumber harga belum dipilih.');
      await upsertDailyRates(businessId, rateItem.id, dates, price, userId);
      await reload();
    },
    [businessId, rateItem, userId, reload]
  );

  const resetPrices = useCallback(
    async (dates: string[]) => {
      if (!rateItem) throw new Error('Item sumber harga belum dipilih.');
      await deleteDailyRates(rateItem.id, dates);
      await reload();
    },
    [rateItem, reload]
  );

  return { overrides, overrideMap, priceOf, loading, reload, setPrices, resetPrices };
}
