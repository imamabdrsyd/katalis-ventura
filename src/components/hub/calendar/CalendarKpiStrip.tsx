'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { TrendingUp, Percent, Gauge, CalendarCheck, Wallet } from 'lucide-react';
import type { Booking } from '@/types';
import { calculateBookingMetrics } from '@/lib/calculations';
import { formatCurrency } from '@/lib/utils';

interface CalendarKpiStripProps {
  bookings: Booking[];
  monthCursor: Date;
  unitsCount: number;
}

/**
 * Strip KPI hospitality untuk bulan aktif: ADR (harga rata-rata per malam),
 * Occupancy, RevPAR, jumlah booking, dan pendapatan kamar. Semua dihitung dari
 * `calculateBookingMetrics` (bookings ter-wire ke EARN via total_amount).
 */
export function CalendarKpiStrip({ bookings, monthCursor, unitsCount }: CalendarKpiStripProps) {
  const m = useMemo(
    () => calculateBookingMetrics(bookings, monthCursor, unitsCount),
    [bookings, monthCursor, unitsCount]
  );

  const monthLabel = format(monthCursor, 'MMMM yyyy', { locale: idLocale });

  const cards = [
    {
      icon: TrendingUp,
      label: 'ADR (rata-rata/malam)',
      value: formatCurrency(m.adr),
      hint: `${m.bookedNights} malam terjual`,
    },
    {
      icon: Percent,
      label: 'Occupancy',
      value: `${m.occupancyPct.toFixed(0)}%`,
      hint: `${m.bookedNights}/${m.availableNights} malam`,
    },
    {
      icon: Gauge,
      label: 'RevPAR',
      value: formatCurrency(m.revPar),
      hint: 'Pendapatan / malam tersedia',
    },
    {
      icon: CalendarCheck,
      label: 'Booking',
      value: String(m.bookingsCount),
      hint: m.revenuePerBooking > 0 ? `${formatCurrency(m.revenuePerBooking)} / booking` : 'bulan ini',
    },
    {
      icon: Wallet,
      label: 'Pendapatan kamar',
      value: formatCurrency(m.roomRevenue),
      hint: monthLabel,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {cards.map(({ icon: Icon, label, value, hint }) => (
        <div key={label} className="card-static p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Icon className="w-4 h-4 text-primary-500 dark:text-primary-400" />
            <span className="text-xs font-medium truncate">{label}</span>
          </div>
          <p className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums truncate">
            {value}
          </p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate">{hint}</p>
        </div>
      ))}
    </div>
  );
}
