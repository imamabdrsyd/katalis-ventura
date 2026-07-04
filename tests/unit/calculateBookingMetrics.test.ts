import { describe, it, expect } from 'vitest';
import { calculateBookingMetrics } from '@/lib/calculations';
import type { Booking } from '@/types';

function mkBooking(overrides: Partial<Booking>): Booking {
  return {
    id: `b-${Math.random().toString(36).slice(2)}`,
    business_id: 'biz',
    unit_id: 'u1',
    contact_id: null,
    transaction_id: null,
    check_in: '2026-07-10',
    check_out: '2026-07-13', // 3 malam
    nights: 3,
    price_per_night: 500_000,
    total_amount: 1_500_000,
    guest_name: 'Tamu',
    guest_count: null,
    status: 'confirmed',
    payment_status: 'unpaid',
    channel: 'manual',
    is_external: false,
    date_estimated: false,
    ical_uid: null,
    notes: null,
    created_by: null,
    updated_by: null,
    created_at: '',
    updated_at: '',
    deleted_at: null,
    ...overrides,
  };
}

const JULY_2026 = new Date(2026, 6, 1); // 31 hari

describe('calculateBookingMetrics', () => {
  it('menghitung ADR / occupancy / RevPAR untuk satu unit + satu booking', () => {
    const m = calculateBookingMetrics([mkBooking({})], JULY_2026, 1);

    expect(m.bookedNights).toBe(3);
    expect(m.availableNights).toBe(31);
    expect(m.roomRevenue).toBe(1_500_000);
    expect(m.adr).toBe(500_000); // 1.5jt / 3 malam
    expect(m.occupancyPct).toBeCloseTo((3 / 31) * 100, 5);
    expect(m.revPar).toBeCloseTo(1_500_000 / 31, 5);
    expect(m.bookingsCount).toBe(1);
    expect(m.revenuePerBooking).toBe(1_500_000);
    // RevPAR harus = ADR × occupancy
    expect(m.revPar).toBeCloseTo(m.adr * (m.occupancyPct / 100), 3);
  });

  it('mengabaikan booking cancelled dan blok eksternal (is_external)', () => {
    const bookings = [
      mkBooking({}),
      mkBooking({ status: 'cancelled', total_amount: 999_999 }),
      mkBooking({ is_external: true, total_amount: 999_999 }),
    ];
    const m = calculateBookingMetrics(bookings, JULY_2026, 1);
    expect(m.bookedNights).toBe(3);
    expect(m.roomRevenue).toBe(1_500_000);
    expect(m.bookingsCount).toBe(1);
  });

  it('mengkliping malam & pendapatan ke bulan berjalan (booking lintas bulan)', () => {
    // 29 Jun → 2 Jul = 3 malam total, tapi hanya 1 malam (1 Jul) jatuh di Juli.
    const m = calculateBookingMetrics(
      [mkBooking({ check_in: '2026-06-29', check_out: '2026-07-02', price_per_night: 400_000 })],
      JULY_2026,
      1
    );
    expect(m.bookedNights).toBe(1);
    expect(m.roomRevenue).toBe(400_000);
  });

  it('availableNights = jumlah unit × hari dalam bulan', () => {
    const m = calculateBookingMetrics([mkBooking({})], JULY_2026, 3);
    expect(m.availableNights).toBe(31 * 3);
    expect(m.occupancyPct).toBeCloseTo((3 / 93) * 100, 5);
  });

  it('mengembalikan nol aman saat tak ada booking', () => {
    const m = calculateBookingMetrics([], JULY_2026, 2);
    expect(m.bookedNights).toBe(0);
    expect(m.adr).toBe(0);
    expect(m.occupancyPct).toBe(0);
    expect(m.revPar).toBe(0);
    expect(m.revenuePerBooking).toBe(0);
  });
});
