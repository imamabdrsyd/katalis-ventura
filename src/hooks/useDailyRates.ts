'use client';

/**
 * Hook kalender harga untuk SATU unit fisik: memuat override harga
 * (unit_daily_rates, key = unit_id) untuk rentang grid yang tampak +
 * menyediakan aksi set/reset harga per kumpulan tanggal. Base price (migr 124)
 * berasal dari item main-service unit per kategori hari (weekday/weekend),
 * di-passing sbg `baseRates`. Harga final per tanggal diresolve via lib murni
 * `@/lib/rates` (override > base by hari).
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import type { BusinessUnit, UnitDailyRate } from '@/types';
import { getDailyRates, upsertDailyRates, deleteDailyRates } from '@/lib/api/dailyRates';
import { buildOverrideMap, resolveNightPriceV2, type NightRate, type UnitBaseRates } from '@/lib/rates';

interface UseDailyRatesArgs {
  businessId: string;
  userId: string;
  unit: BusinessUnit | null; // unit fisik yang sedang dilihat kalendernya
  baseRates: UnitBaseRates; // base weekday/weekend/monthly dari item main-service unit
  gridStart: Date;
  gridEnd: Date; // eksklusif
}

export function useDailyRates({ businessId, userId, unit, baseRates, gridStart, gridEnd }: UseDailyRatesArgs) {
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

  // Unit punya harga bila minimal ada base weekday (atau override apa pun).
  const hasBase = baseRates.weekday != null || baseRates.weekend != null;

  /** Harga final untuk satu tanggal grid; null bila unit belum punya base harga. */
  const priceOf = useCallback(
    (dateISO: string): NightRate | null => {
      if (!unit || !hasBase) return null;
      return resolveNightPriceV2(dateISO, baseRates, overrideMap);
    },
    [unit, hasBase, baseRates, overrideMap]
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
