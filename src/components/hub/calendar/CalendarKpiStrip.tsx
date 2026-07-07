'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { TrendingUp, Percent, Gauge, CalendarCheck, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Booking } from '@/types';
import { calculateBookingMetrics } from '@/lib/calculations';
import { formatCurrency } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useLanguage } from '@/context/LanguageContext';

interface CalendarKpiStripProps {
  bookings: Booking[];
  monthCursor: Date;
  unitsCount: number;
}

// Formatter per-jenis nilai untuk AnimatedNumber (angka mentah dianimasikan, format saat render).
const fmtCurrency = (v: number) => formatCurrency(v);
const fmtPercent = (v: number) => `${Math.round(v)}%`;
const fmtInteger = (v: number) => String(Math.round(v));

/**
 * Strip KPI hospitality untuk bulan aktif: ADR (harga rata-rata per malam),
 * Occupancy, RevPAR, jumlah booking, dan pendapatan kamar. Semua dihitung dari
 * `calculateBookingMetrics` (bookings ter-wire ke EARN via total_amount).
 *
 * Angka pakai count-up (`AnimatedNumber`) yang re-animasi tiap ganti bulan
 * (`replayKey` = kursor bulan), selaras dgn KPI dashboard & sliding filter PNL.
 */
export function CalendarKpiStrip({ bookings, monthCursor, unitsCount }: CalendarKpiStripProps) {
  const { t, locale } = useLanguage();
  const c = t.calendar;
  const m = useMemo(
    () => calculateBookingMetrics(bookings, monthCursor, unitsCount),
    [bookings, monthCursor, unitsCount]
  );

  const monthLabel = format(monthCursor, 'MMMM yyyy', { locale: locale === 'id' ? idLocale : undefined });
  // Re-animasi count-up saat bulan berpindah (mirip sliding periode di PNL).
  const animationKey = format(monthCursor, 'yyyy-MM');

  const cards: {
    icon: LucideIcon;
    label: string;
    value: number;
    formatter: (v: number) => string;
    hint: string;
  }[] = [
    {
      icon: TrendingUp,
      label: c.kpiAdr,
      value: m.adr,
      formatter: fmtCurrency,
      hint: c.kpiAdrHint.replace('{n}', String(m.bookedNights)),
    },
    {
      icon: Percent,
      label: c.kpiOccupancy,
      value: m.occupancyPct,
      formatter: fmtPercent,
      hint: c.kpiOccupancyHint.replace('{booked}', String(m.bookedNights)).replace('{available}', String(m.availableNights)),
    },
    {
      icon: Gauge,
      label: c.kpiRevpar,
      value: m.revPar,
      formatter: fmtCurrency,
      hint: c.kpiRevparHint,
    },
    {
      icon: CalendarCheck,
      label: c.kpiBookings,
      value: m.bookingsCount,
      formatter: fmtInteger,
      hint:
        m.revenuePerBooking > 0
          ? c.kpiBookingsHintPer.replace('{amount}', formatCurrency(m.revenuePerBooking))
          : c.kpiBookingsHintNone,
    },
    {
      icon: Wallet,
      label: c.kpiRoomRevenue,
      value: m.roomRevenue,
      formatter: fmtCurrency,
      hint: monthLabel,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {cards.map(({ icon: Icon, label, value, formatter, hint }) => (
        <div key={label} className="card-static p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Icon className="w-4 h-4 text-primary-500 dark:text-primary-400" />
            <span className="text-xs font-medium truncate">{label}</span>
          </div>
          <p className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums truncate">
            <AnimatedNumber value={value} formatter={formatter} replayKey={animationKey} />
          </p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate">{hint}</p>
        </div>
      ))}
    </div>
  );
}
