import { describe, it, expect } from 'vitest';
import {
  quoteStay,
  groupIntoRanges,
  listDatesInRange,
  buildOverrideMap,
  resolveNightPrice,
  baseRateForDate,
  resolveNightPriceV2,
  quoteStayV2,
  buildUnitBaseRates,
  type UnitBaseRates,
} from '@/lib/rates';
import type { CatalogItem } from '@/types';

describe('quoteStay', () => {
  it('total = nights × default bila tanpa override', () => {
    const q = quoteStay('2026-07-10', '2026-07-13', 350_000, []);
    expect(q.nights).toBe(3);
    expect(q.total).toBe(1_050_000);
    expect(q.breakdown.every((n) => !n.overridden)).toBe(true);
  });

  it('malam ber-override dihitung dengan harga override', () => {
    // 30 Des–2 Jan (3 malam): 30 & 31 Des peak 750k, 1 Jan default 350k
    const q = quoteStay('2026-12-30', '2027-01-02', 350_000, [
      { date: '2026-12-30', price: 750_000 },
      { date: '2026-12-31', price: 750_000 },
    ]);
    expect(q.nights).toBe(3);
    expect(q.total).toBe(750_000 + 750_000 + 350_000);
    expect(q.breakdown[0].overridden).toBe(true);
    expect(q.breakdown[2].overridden).toBe(false);
  });

  it('rentang tak valid → 0 malam, total 0', () => {
    const q = quoteStay('2026-07-13', '2026-07-10', 350_000, []);
    expect(q.nights).toBe(0);
    expect(q.total).toBe(0);
  });

  it('override harga 0 tetap dihormati (gratis ≠ default)', () => {
    const q = quoteStay('2026-07-10', '2026-07-11', 350_000, [
      { date: '2026-07-10', price: 0 },
    ]);
    expect(q.total).toBe(0);
    expect(q.breakdown[0].overridden).toBe(true);
  });
});

describe('groupIntoRanges', () => {
  it('mengelompokkan malam berurutan berharga sama', () => {
    const q = quoteStay('2026-12-29', '2027-01-02', 350_000, [
      { date: '2026-12-30', price: 750_000 },
      { date: '2026-12-31', price: 750_000 },
    ]);
    const ranges = groupIntoRanges(q.breakdown);
    expect(ranges).toHaveLength(3); // 29 default | 30–31 peak | 1 Jan default
    expect(ranges[1]).toMatchObject({ start: '2026-12-30', end: '2026-12-31', nights: 2, price: 750_000 });
  });

  it('harga sama tapi tidak berurutan → rentang terpisah', () => {
    const ranges = groupIntoRanges([
      { date: '2026-07-10', price: 450_000, overridden: true },
      { date: '2026-07-12', price: 450_000, overridden: true },
    ]);
    expect(ranges).toHaveLength(2);
  });
});

describe('listDatesInRange', () => {
  it('inklusif kedua ujung + auto-swap bila terbalik', () => {
    expect(listDatesInRange('2026-07-10', '2026-07-12')).toEqual([
      '2026-07-10', '2026-07-11', '2026-07-12',
    ]);
    expect(listDatesInRange('2026-07-12', '2026-07-10')).toHaveLength(3);
  });

  it('filter hari: hanya Jumat/Sabtu dalam rentang', () => {
    // 1–14 Jul 2026: Jumat = 3 & 10, Sabtu = 4 & 11
    const dates = listDatesInRange('2026-07-01', '2026-07-14', new Set([5, 6]));
    expect(dates).toEqual(['2026-07-03', '2026-07-04', '2026-07-10', '2026-07-11']);
  });
});

describe('resolveNightPrice', () => {
  it('override menang atas default', () => {
    const map = buildOverrideMap([{ date: '2026-08-17', price: 600_000 }]);
    expect(resolveNightPrice('2026-08-17', 350_000, map).price).toBe(600_000);
    expect(resolveNightPrice('2026-08-18', 350_000, map).price).toBe(350_000);
  });
});

// ── Model harga baru (migr 124): weekday/weekend/monthly ────────────────────
const BASE: UnitBaseRates = { weekday: 350_000, weekend: 450_000, monthly: 4_400_000 };

describe('baseRateForDate', () => {
  it('weekday (Sen–Jum) pakai weekday, weekend (Sab+Min) pakai weekend', () => {
    expect(baseRateForDate('2026-08-03', BASE)).toBe(350_000); // Mon
    expect(baseRateForDate('2026-08-07', BASE)).toBe(350_000); // Fri
    expect(baseRateForDate('2026-08-08', BASE)).toBe(450_000); // Sat
    expect(baseRateForDate('2026-08-09', BASE)).toBe(450_000); // Sun
  });

  it('tanpa weekend rate → weekend pakai weekday (fallback)', () => {
    const b: UnitBaseRates = { weekday: 350_000, weekend: null, monthly: null };
    expect(baseRateForDate('2026-08-08', b)).toBe(350_000); // Sat → weekday
  });

  it('tanpa base sama sekali → null', () => {
    expect(baseRateForDate('2026-08-08', { weekday: null, weekend: null, monthly: null })).toBeNull();
  });
});

describe('resolveNightPriceV2', () => {
  it('override menang atas base weekday/weekend', () => {
    const map = buildOverrideMap([{ date: '2026-08-08', price: 700_000 }]);
    expect(resolveNightPriceV2('2026-08-08', BASE, map)).toMatchObject({ price: 700_000, overridden: true }); // Sat override
    expect(resolveNightPriceV2('2026-08-09', BASE, map)).toMatchObject({ price: 450_000, overridden: false }); // Sun base weekend
    expect(resolveNightPriceV2('2026-08-07', BASE, map)).toMatchObject({ price: 350_000, overridden: false }); // Fri base weekday
  });

  it('tanpa base → price 0', () => {
    const map = buildOverrideMap([]);
    expect(resolveNightPriceV2('2026-08-08', { weekday: null, weekend: null, monthly: null }, map).price).toBe(0);
  });
});

describe('quoteStayV2', () => {
  it('Σ per malam campur weekday+weekend', () => {
    // 7–10 Aug: Fri(7)+Sat(8)+Sun(9) = 350k + 450k + 450k
    const q = quoteStayV2('2026-08-07', '2026-08-10', BASE, []);
    expect(q.nights).toBe(3);
    expect(q.total).toBe(350_000 + 450_000 + 450_000);
  });

  it('long-stay > 27 malam pakai rate monthly (bukan Σ harian)', () => {
    // 1 Jul → 1 Aug = 31 malam > 27 → total = monthly 4.4jt
    const q = quoteStayV2('2026-07-01', '2026-08-01', BASE, []);
    expect(q.nights).toBe(31);
    expect(q.total).toBe(4_400_000);
  });

  it('long-stay tapi tanpa monthly → tetap Σ harian', () => {
    const b: UnitBaseRates = { weekday: 300_000, weekend: 300_000, monthly: null };
    const q = quoteStayV2('2026-07-01', '2026-08-01', b, []);
    expect(q.nights).toBe(31);
    expect(q.total).toBe(31 * 300_000);
  });

  it('override tetap menang di dalam quote pendek', () => {
    const q = quoteStayV2('2026-08-07', '2026-08-09', BASE, [{ date: '2026-08-08', price: 1_000_000 }]);
    // Fri 350k + Sat override 1jt
    expect(q.total).toBe(350_000 + 1_000_000);
  });
});

describe('buildUnitBaseRates', () => {
  const mk = (over: Partial<CatalogItem>): CatalogItem =>
    ({
      id: Math.random().toString(36).slice(2), business_id: 'b', name: 'x',
      item_type: 'service', default_price: 0, is_active: true, sort_order: 0,
      created_at: '', updated_at: '', ...over,
    } as CatalogItem);

  it('memetakan item main-service per rate_kind', () => {
    const items = [
      mk({ service_role: 'main', rate_kind: 'weekday', default_price: 350_000 }),
      mk({ service_role: 'main', rate_kind: 'weekend', default_price: 450_000 }),
      mk({ service_role: 'main', rate_kind: 'monthly', default_price: 4_400_000 }),
      mk({ service_role: 'addon', rate_kind: null, default_price: 50_000 }), // Cleaning — diabaikan
    ];
    expect(buildUnitBaseRates(items)).toEqual({ weekday: 350_000, weekend: 450_000, monthly: 4_400_000 });
  });

  it('item nonaktif diabaikan; kategori kosong → null', () => {
    const items = [
      mk({ service_role: 'main', rate_kind: 'weekday', default_price: 350_000, is_active: false }),
      mk({ service_role: 'main', rate_kind: 'weekend', default_price: 450_000 }),
    ];
    expect(buildUnitBaseRates(items)).toEqual({ weekday: null, weekend: 450_000, monthly: null });
  });
});
