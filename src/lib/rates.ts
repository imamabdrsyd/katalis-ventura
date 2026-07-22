/**
 * Resolver harga per malam (kalender harga akomodasi) — fungsi murni, tanpa IO.
 *
 * Model (migr 124): harga dasar (base) berasal dari item main-service per unit,
 * per KATEGORI HARI — weekday (Sen–Jum) & weekend (Sab+Min). Di-override per
 * tanggal oleh baris unit_daily_rates. Resolusi per tanggal:
 *   override > base(weekday|weekend by hari) > 0.
 * Long-stay (> 27 malam) di halaman publik pakai rate monthly bila ada.
 * Dipakai bersama oleh grid kalender, auto-total BookingModal, quote AI
 * concierge, dan widget booking halaman publik.
 */

import type { CatalogItem } from '@/types';

export interface RateOverride {
  date: string; // ISO YYYY-MM-DD
  price: number;
}

/** Harga dasar per kategori (default_price item main-service unit). */
export interface UnitBaseRates {
  weekday: number | null;
  weekend: number | null; // null → pakai weekday
  monthly: number | null; // acuan long-stay, tak mewarnai grid harian
}

/** Rentang menginap di atas ambang ini (malam) memakai rate monthly bila ada. */
export const MONTHLY_STAY_THRESHOLD = 27;

/** Hari akhir pekan (getUTCDay): 6=Sabtu, 0=Minggu. */
function isWeekendISO(dateISO: string): boolean {
  const dow = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Harga dasar untuk satu tanggal by kategori hari: weekend (Sab+Min) → weekend
 * rate (fallback weekday bila null); selain itu weekday. null bila tak ada base.
 */
export function baseRateForDate(dateISO: string, base: UnitBaseRates): number | null {
  if (isWeekendISO(dateISO)) return base.weekend ?? base.weekday;
  return base.weekday;
}

/** Rakit UnitBaseRates dari item katalog satu unit (ambil main-service by rate_kind). */
export function buildUnitBaseRates(items: CatalogItem[]): UnitBaseRates {
  const pick = (kind: 'weekday' | 'weekend' | 'monthly'): number | null => {
    const it = items.find(
      (i) => i.is_active && i.service_role === 'main' && i.rate_kind === kind
    );
    return it ? Number(it.default_price) : null;
  };
  return { weekday: pick('weekday'), weekend: pick('weekend'), monthly: pick('monthly') };
}

export interface NightRate {
  date: string;
  price: number;
  overridden: boolean;
}

export interface StayQuote {
  nights: number;
  total: number;
  breakdown: NightRate[];
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Map tanggal → harga override, dari baris unit_daily_rates. */
export function buildOverrideMap(overrides: RateOverride[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const o of overrides) map.set(o.date, Number(o.price));
  return map;
}

/** Harga satu malam: override bila ada, selain itu default. */
export function resolveNightPrice(
  dateISO: string,
  defaultPrice: number,
  overrideMap: Map<string, number>
): NightRate {
  const override = overrideMap.get(dateISO);
  return {
    date: dateISO,
    price: override ?? defaultPrice,
    overridden: override !== undefined,
  };
}

/**
 * Harga satu malam model baru (migr 124): override > base(weekday|weekend by hari).
 * price=0 bila tak ada base sama sekali (unit belum punya item main-service).
 */
export function resolveNightPriceV2(
  dateISO: string,
  base: UnitBaseRates,
  overrideMap: Map<string, number>
): NightRate {
  const override = overrideMap.get(dateISO);
  return {
    date: dateISO,
    price: override ?? baseRateForDate(dateISO, base) ?? 0,
    overridden: override !== undefined,
  };
}

/**
 * Quote menginap model baru: Σ per malam via resolveNightPriceV2. Bila total
 * malam > MONTHLY_STAY_THRESHOLD dan base.monthly tersedia, total = harga monthly
 * (breakdown flat = monthly/nights) — dipakai widget publik untuk sewa bulanan.
 */
export function quoteStayV2(
  checkIn: string,
  checkOut: string,
  base: UnitBaseRates,
  overrides: RateOverride[]
): StayQuote {
  const map = buildOverrideMap(overrides);
  const breakdown: NightRate[] = [];
  let cursor = checkIn;
  for (let i = 0; cursor < checkOut && i < 1000; i++) {
    breakdown.push(resolveNightPriceV2(cursor, base, map));
    cursor = addDaysISO(cursor, 1);
  }
  const nights = breakdown.length;
  if (nights > MONTHLY_STAY_THRESHOLD && base.monthly != null && base.monthly > 0) {
    return { nights, total: base.monthly, breakdown };
  }
  return {
    nights,
    total: breakdown.reduce((s, n) => s + n.price, 0),
    breakdown,
  };
}

/**
 * Quote menginap [checkIn, checkOut): total = Σ harga per malam + breakdown.
 * checkOut eksklusif (malam terakhir = checkOut - 1 hari). Rentang tak valid → 0 malam.
 */
export function quoteStay(
  checkIn: string,
  checkOut: string,
  defaultPrice: number,
  overrides: RateOverride[]
): StayQuote {
  const map = buildOverrideMap(overrides);
  const breakdown: NightRate[] = [];
  let cursor = checkIn;
  // Guard 1000 malam — hindari loop liar bila input rusak.
  for (let i = 0; cursor < checkOut && i < 1000; i++) {
    breakdown.push(resolveNightPrice(cursor, defaultPrice, map));
    cursor = addDaysISO(cursor, 1);
  }
  return {
    nights: breakdown.length,
    total: breakdown.reduce((s, n) => s + n.price, 0),
    breakdown,
  };
}

/**
 * Kelompokkan malam berharga sama & berurutan menjadi rentang ringkas —
 * untuk teks breakdown ("2×450rb + 1×750rb") dan prompt AI.
 */
export interface RateRange {
  start: string;
  end: string; // inklusif (malam terakhir rentang)
  nights: number;
  price: number;
  overridden: boolean;
}

export function groupIntoRanges(nightRates: NightRate[]): RateRange[] {
  const ranges: RateRange[] = [];
  for (const n of nightRates) {
    const last = ranges[ranges.length - 1];
    if (last && last.price === n.price && last.overridden === n.overridden && addDaysISO(last.end, 1) === n.date) {
      last.end = n.date;
      last.nights += 1;
    } else {
      ranges.push({ start: n.date, end: n.date, nights: 1, price: n.price, overridden: n.overridden });
    }
  }
  return ranges;
}

/** Daftar tanggal ISO dalam [start, end] inklusif, opsional difilter hari (0=Min..6=Sab). */
export function listDatesInRange(
  startISO: string,
  endISO: string,
  allowedWeekdays?: Set<number>
): string[] {
  const out: string[] = [];
  let cursor = startISO <= endISO ? startISO : endISO;
  const stop = startISO <= endISO ? endISO : startISO;
  for (let i = 0; cursor <= stop && i < 1000; i++) {
    if (!allowedWeekdays || allowedWeekdays.has(new Date(`${cursor}T00:00:00Z`).getUTCDay())) {
      out.push(cursor);
    }
    cursor = addDaysISO(cursor, 1);
  }
  return out;
}
