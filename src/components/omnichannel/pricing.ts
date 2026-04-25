import type { PublicBusiness, PublicPricingRule } from './types';

export interface PricingBreakdownLine {
  /** Harga per unit pada tanggal/range ini */
  unit_price: number;
  /** Jumlah unit (misal: hari) */
  units: number;
  /** Subtotal = unit_price × units */
  subtotal: number;
  /** Label aturan (e.g. "High Season") atau null untuk harga default */
  rule_label: string | null;
  /** Tanggal mulai segment ini (YYYY-MM-DD) */
  date_from: string;
  /** Tanggal selesai segment ini (YYYY-MM-DD, inclusive) */
  date_to: string;
}

export interface PricingBreakdown {
  lines: PricingBreakdownLine[];
  total: number;
  unit: string | null;
  /** Apakah ada harga (default_price atau rule yang berlaku) */
  has_price: boolean;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function priceForDate(
  dateISO: string,
  rules: PublicPricingRule[],
  defaultPrice: number | null
): { price: number; label: string | null } | null {
  // Aturan paling baru yang cocok menang (sortedRules urutan masuk array)
  const match = rules.find((r) => dateISO >= r.date_from && dateISO <= r.date_to);
  if (match) return { price: match.price, label: match.label };
  if (defaultPrice != null && defaultPrice > 0) return { price: defaultPrice, label: null };
  return null;
}

/**
 * Hitung harga untuk single date (1 unit dengan tarif yang berlaku pada tanggal itu).
 */
export function computeSinglePricing(
  business: PublicBusiness,
  date: string
): PricingBreakdown {
  const unit = business.price_unit ?? null;
  if (!business.show_pricing || !date) {
    return { lines: [], total: 0, unit, has_price: false };
  }
  const rules = business.pricing_rules ?? [];
  const result = priceForDate(date, rules, business.default_price ?? null);
  if (!result) return { lines: [], total: 0, unit, has_price: false };

  const line: PricingBreakdownLine = {
    unit_price: result.price,
    units: 1,
    subtotal: result.price,
    rule_label: result.label,
    date_from: date,
    date_to: date,
  };
  return { lines: [line], total: result.price, unit, has_price: true };
}

/**
 * Hitung harga untuk date range (per unit dihitung tiap hari, exclusive checkout — hari menginap).
 * Konsekutif tanggal dengan tarif sama digrup jadi 1 line.
 */
export function computeRangePricing(
  business: PublicBusiness,
  checkin: string,
  checkout: string
): PricingBreakdown {
  const unit = business.price_unit ?? null;
  if (!business.show_pricing || !checkin || !checkout || checkin >= checkout) {
    return { lines: [], total: 0, unit, has_price: false };
  }
  const rules = business.pricing_rules ?? [];
  const lines: PricingBreakdownLine[] = [];
  let total = 0;

  let cursor = checkin;
  let segmentStart = checkin;
  let segmentPrice: number | null = null;
  let segmentLabel: string | null = null;
  let segmentUnits = 0;

  function flushSegment(endDateInclusive: string) {
    if (segmentPrice == null || segmentUnits === 0) return;
    const subtotal = segmentPrice * segmentUnits;
    lines.push({
      unit_price: segmentPrice,
      units: segmentUnits,
      subtotal,
      rule_label: segmentLabel,
      date_from: segmentStart,
      date_to: endDateInclusive,
    });
    total += subtotal;
    segmentPrice = null;
    segmentLabel = null;
    segmentUnits = 0;
  }

  while (cursor < checkout) {
    const result = priceForDate(cursor, rules, business.default_price ?? null);
    if (!result) {
      // Tidak ada harga untuk tanggal ini → batalkan
      return { lines: [], total: 0, unit, has_price: false };
    }

    if (segmentPrice == null) {
      // Mulai segment baru
      segmentStart = cursor;
      segmentPrice = result.price;
      segmentLabel = result.label;
      segmentUnits = 1;
    } else if (result.price === segmentPrice && result.label === segmentLabel) {
      // Lanjut segment yang sama
      segmentUnits += 1;
    } else {
      // Tutup segment lama (end inclusive = hari sebelumnya)
      flushSegment(addDaysISO(cursor, -1));
      // Mulai segment baru
      segmentStart = cursor;
      segmentPrice = result.price;
      segmentLabel = result.label;
      segmentUnits = 1;
    }
    cursor = addDaysISO(cursor, 1);
  }
  // Flush final segment
  flushSegment(addDaysISO(checkout, -1));

  return { lines, total, unit, has_price: lines.length > 0 };
}

export function formatRupiahShort(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}
