import { describe, it, expect } from 'vitest';
import {
  quoteStay,
  groupIntoRanges,
  listDatesInRange,
  buildOverrideMap,
  resolveNightPrice,
} from '@/lib/rates';

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
