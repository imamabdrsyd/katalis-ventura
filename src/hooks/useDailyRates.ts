'use client';

/**
 * Hook kalender harga untuk SATU unit fisik: memuat override harga
 * (unit_daily_rates, key = unit_id) untuk rentang grid yang tampak +
 * menyediakan aksi set/reset harga per kumpulan tanggal. Harga default berasal
 * dari item sumber harga unit (business_units.rate_item_id, hydrated sbg
 * unit.rate_item). Harga final per tanggal diresolve via lib murni `@/lib/rates`.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import type { BusinessUnit, UnitDailyRate } from '@/types';
import { getDailyRates, upsertDailyRates, deleteDailyRates } from '@/lib/api/dailyRates';
import { buildOverrideMap, resolveNightPrice, type NightRate } from '@/lib/rates';

interface UseDailyRatesArgs {
  businessId: string;
  userId: string;
  unit: BusinessUnit | null; // unit fisik yang sedang dilihat kalendernya
  gridStart: Date;
  gridEnd: Date; // eksklusif
}

export function useDailyRates({ businessId, userId, unit, gridStart, gridEnd }: UseDailyRatesArgs) {
  const [overrides, setOverrides] = useState<UnitDailyRate[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!unit) {
      setOverrides([]);
      return;
    }
    setLoading(true);
    try {
      const from = format(gridStart, 'yyyy-MM-dd');
      const to = format(gridEnd, 'yyyy-MM-dd');
      setOverrides(await getDailyRates(unit.id, from, to));
    } catch {
      setOverrides([]);
    } finally {
      setLoading(false);
    }
  }, [unit, gridStart, gridEnd]);

  useEffect(() => {
    reload();
  }, [reload]);

  const overrideMap = useMemo(
    () => buildOverrideMap(overrides.map((o) => ({ date: o.date, price: Number(o.price) }))),
    [overrides]
  );

  /** Harga final untuk satu tanggal grid; null bila unit/item sumber belum ada. */
  const priceOf = useCallback(
    (dateISO: string): NightRate | null => {
      if (!unit?.rate_item) return null;
      return resolveNightPrice(dateISO, Number(unit.rate_item.default_price), overrideMap);
    },
    [unit, overrideMap]
  );

  const setPrices = useCallback(
    async (dates: string[], price: number) => {
      if (!unit) throw new Error('Unit belum dipilih.');
      await upsertDailyRates(businessId, unit.id, dates, price, userId);
      await reload();
    },
    [businessId, unit, userId, reload]
  );

  const resetPrices = useCallback(
    async (dates: string[]) => {
      if (!unit) throw new Error('Unit belum dipilih.');
      await deleteDailyRates(unit.id, dates);
      await reload();
    },
    [unit, reload]
  );

  return { overrides, overrideMap, priceOf, loading, reload, setPrices, resetPrices };
}
