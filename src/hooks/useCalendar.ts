'use client';

/**
 * Hook state & logika kalender booking (hub /calendar, bisnis jasa akomodasi).
 *
 * Mengelola kursor bulan + memuat booking yang tampak di grid (full weeks),
 * lalu menyediakan aksi mutasi (buat/edit/batal/hapus, tandai lunas) dan cek
 * overlap (proteksi double-booking). Wiring revenue (EARN) ada di
 * `markBookingPaid` (lib/api/bookings) — hook cuma memanggil & me-reload.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  addDays,
  format,
} from 'date-fns';
import type { Account, Booking, BookingInsert, BookingUpdate } from '@/types';
import type { PaymentMethod } from '@/lib/accounting/salesCheckout';
import {
  getBookingsForRange,
  findOverlappingBookings,
  createBooking,
  updateBooking,
  cancelBooking,
  deleteBooking,
  markBookingPaid,
} from '@/lib/api/bookings';

const WEEK_OPTS = { weekStartsOn: 1 as const }; // Senin sebagai awal minggu (ID)

interface UseCalendarArgs {
  businessId: string;
  userId: string;
  accounts: Account[];
}

export function useCalendar({ businessId, userId, accounts }: UseCalendarArgs) {
  const [monthCursor, setMonthCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rentang grid = full weeks yang menutupi bulan. gridEnd eksklusif (hari setelah sel terakhir).
  const gridStart = useMemo(
    () => startOfWeek(startOfMonth(monthCursor), WEEK_OPTS),
    [monthCursor]
  );
  const gridEnd = useMemo(
    () => addDays(endOfWeek(endOfMonth(monthCursor), WEEK_OPTS), 1),
    [monthCursor]
  );

  const reload = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const from = format(gridStart, 'yyyy-MM-dd');
      const to = format(gridEnd, 'yyyy-MM-dd');
      setBookings(await getBookingsForRange(businessId, from, to));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat booking');
    } finally {
      setLoading(false);
    }
  }, [businessId, gridStart, gridEnd]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── Navigasi bulan ──────────────────────────────────────────────────────────
  const goPrevMonth = useCallback(() => setMonthCursor((m) => startOfMonth(addMonths(m, -1))), []);
  const goNextMonth = useCallback(() => setMonthCursor((m) => startOfMonth(addMonths(m, 1))), []);
  const goToday = useCallback(() => setMonthCursor(startOfMonth(new Date())), []);

  // ── Mutasi ──────────────────────────────────────────────────────────────────
  const checkOverlap = useCallback(
    (catalogItemId: string, checkIn: string, checkOut: string, excludeId?: string) =>
      findOverlappingBookings(businessId, catalogItemId, checkIn, checkOut, excludeId),
    [businessId]
  );

  const create = useCallback(
    async (insert: Omit<BookingInsert, 'business_id' | 'created_by'>) => {
      const booking = await createBooking({ ...insert, business_id: businessId, created_by: userId });
      await reload();
      return booking;
    },
    [businessId, userId, reload]
  );

  const update = useCallback(
    async (id: string, updates: BookingUpdate) => {
      const booking = await updateBooking(id, updates);
      await reload();
      return booking;
    },
    [reload]
  );

  const markPaid = useCallback(
    async (booking: Booking, method: PaymentMethod) => {
      const updated = await markBookingPaid(booking, { method, accounts, userId });
      await reload();
      return updated;
    },
    [accounts, userId, reload]
  );

  const cancel = useCallback(
    async (id: string) => {
      await cancelBooking(id);
      await reload();
    },
    [reload]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteBooking(id);
      await reload();
    },
    [reload]
  );

  return {
    monthCursor,
    gridStart,
    gridEnd,
    bookings,
    loading,
    error,
    goPrevMonth,
    goNextMonth,
    goToday,
    reload,
    checkOverlap,
    create,
    update,
    markPaid,
    cancel,
    remove,
  };
}
