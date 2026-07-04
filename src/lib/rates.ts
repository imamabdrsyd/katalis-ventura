/**
 * Resolver harga per malam (kalender harga akomodasi) — fungsi murni, tanpa IO.
 *
 * Model: harga dasar = default_price item sumber (business_units.rate_item_id —
 * per unit fisik), di-override per tanggal oleh baris unit_daily_rates. Resolusi
 * per tanggal:
 * override > default. Dipakai bersama oleh grid kalender (mode Harga), auto-total
 * BookingModal, quote AI concierge, dan kalender harga halaman publik.
 */

export interface RateOverride {
  date: string; // ISO YYYY-MM-DD
  price: number;
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
