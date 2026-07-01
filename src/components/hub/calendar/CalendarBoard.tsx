'use client';

import { useMemo } from 'react';
import {
  addDays,
  parseISO,
  format,
  differenceInCalendarDays,
  isSameMonth,
  isToday,
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Link2 } from 'lucide-react';
import type { Booking } from '@/types';
import {
  getBookingDisplayState,
  BOOKING_BAR_CLASSES,
  BOOKING_DOT_CLASSES,
  BOOKING_STATE_LABELS,
  type BookingDisplayState,
} from '@/lib/bookingStatus';

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const LEGEND: BookingDisplayState[] = ['confirmed', 'paid', 'tentative', 'completed', 'external'];
const LANE_H = 24; // tinggi bar + gap
const HEADER_H = 30; // ruang untuk angka tanggal

interface CalendarBoardProps {
  monthCursor: Date;
  gridStart: Date;
  gridEnd: Date; // eksklusif
  bookings: Booking[];
  loading: boolean;
  onDayClick: (dateISO: string) => void;
  onBookingClick: (booking: Booking) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onNew: () => void;
  onOpenSync: () => void;
}

export function CalendarBoard({
  monthCursor,
  gridStart,
  gridEnd,
  bookings,
  loading,
  onDayClick,
  onBookingClick,
  onPrev,
  onNext,
  onToday,
  onNew,
  onOpenSync,
}: CalendarBoardProps) {
  const weeks = useMemo(() => {
    const days: Date[] = [];
    let d = gridStart;
    while (d < gridEnd) {
      days.push(d);
      d = addDays(d, 1);
    }
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [gridStart, gridEnd]);

  return (
    <div className="card-static p-0 overflow-hidden">
      {/* Toolbar bulan */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Bulan sebelumnya"
            className="btn-icon"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 min-w-[9rem] text-center capitalize">
            {format(monthCursor, 'MMMM yyyy', { locale: idLocale })}
          </h2>
          <button type="button" onClick={onNext} aria-label="Bulan berikutnya" className="btn-icon">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={onToday} className="btn-ghost ml-1 px-3 py-1.5 text-xs">
            Hari ini
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSync}
            className="btn-ghost inline-flex items-center gap-1.5"
            title="Sinkronisasi kalender Airbnb / Booking.com"
          >
            <Link2 className="w-4 h-4" /> <span className="hidden sm:inline">iCal OTA</span>
          </button>
          <button type="button" onClick={onNew} className="btn-primary inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Booking
          </button>
        </div>
      </div>

      {/* Header hari */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 text-center"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Minggu */}
      <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
        {weeks.map((week, wi) => {
          const weekStart = week[0];
          const weekEndExclusiveStr = format(addDays(weekStart, 7), 'yyyy-MM-dd');
          const weekStartStr = format(weekStart, 'yyyy-MM-dd');

          // Booking yang beririsan minggu ini
          const weekBookings = bookings
            .filter((b) => b.check_in < weekEndExclusiveStr && b.check_out > weekStartStr)
            .sort((a, b) => a.check_in.localeCompare(b.check_in) || b.nights - a.nights);

          // Lane assignment (greedy) agar bar tidak bertumpuk
          const lanes: Booking[][] = [];
          const laneOf = new Map<string, number>();
          for (const b of weekBookings) {
            let placed = false;
            for (let i = 0; i < lanes.length; i++) {
              const conflict = lanes[i].some(
                (x) => x.check_in < b.check_out && x.check_out > b.check_in
              );
              if (!conflict) {
                lanes[i].push(b);
                laneOf.set(b.id, i);
                placed = true;
                break;
              }
            }
            if (!placed) {
              lanes.push([b]);
              laneOf.set(b.id, lanes.length - 1);
            }
          }

          const cellMinH = HEADER_H + Math.max(1, lanes.length) * LANE_H + 8;

          return (
            <div
              key={wi}
              className="relative border-b border-gray-100 dark:border-gray-800 last:border-b-0"
            >
              {/* Sel hari (base layer, click = buat booking) */}
              <div className="grid grid-cols-7" style={{ minHeight: cellMinH }}>
                {week.map((day, di) => {
                  const inMonth = isSameMonth(day, monthCursor);
                  const today = isToday(day);
                  return (
                    <button
                      key={di}
                      type="button"
                      onClick={() => onDayClick(format(day, 'yyyy-MM-dd'))}
                      className={`text-left px-2 py-1.5 border-r border-gray-100 dark:border-gray-800 last:border-r-0 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                        inMonth ? 'bg-transparent' : 'bg-gray-50/60 dark:bg-gray-900/30'
                      }`}
                      title="Klik untuk buat booking"
                    >
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                          today
                            ? 'bg-primary-500 text-white font-bold'
                            : inMonth
                              ? 'text-gray-700 dark:text-gray-200'
                              : 'text-gray-300 dark:text-gray-600'
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Overlay bar booking */}
              <div
                className="pointer-events-none absolute left-0 right-0 grid grid-cols-7 gap-y-1"
                style={{ top: HEADER_H, gridAutoRows: `${LANE_H - 4}px` }}
              >
                {weekBookings.map((b) => {
                  const startD = parseISO(b.check_in);
                  const lastNight = addDays(parseISO(b.check_out), -1);
                  const segStart = startD < weekStart ? weekStart : startD;
                  const weekEnd = addDays(weekStart, 6);
                  const segEnd = lastNight > weekEnd ? weekEnd : lastNight;
                  const startIdx = differenceInCalendarDays(segStart, weekStart);
                  const endIdx = differenceInCalendarDays(segEnd, weekStart);
                  const span = Math.max(1, endIdx - startIdx + 1);
                  const isRealStart = b.check_in === format(segStart, 'yyyy-MM-dd');
                  const isRealEnd = format(lastNight, 'yyyy-MM-dd') === format(segEnd, 'yyyy-MM-dd');
                  const lane = laneOf.get(b.id) ?? 0;
                  const state = getBookingDisplayState(b);
                  const label = b.guest_name || b.contact?.name || b.catalog_item?.name || 'Booking';

                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookingClick(b);
                      }}
                      title={`${label} · ${b.check_in} → ${b.check_out}`}
                      style={{
                        gridColumn: `${startIdx + 1} / span ${span}`,
                        gridRow: lane + 1,
                      }}
                      className={`pointer-events-auto min-w-0 truncate px-2 text-[11px] leading-[18px] font-medium transition-opacity hover:opacity-90 ${
                        BOOKING_BAR_CLASSES[state]
                      } ${isRealStart ? 'rounded-l-md ml-0.5' : ''} ${
                        isRealEnd ? 'rounded-r-md mr-0.5' : ''
                      } ${!isRealStart && !isRealEnd ? '' : ''}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 border-t border-gray-100 dark:border-gray-700">
        {LEGEND.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className={`w-2.5 h-2.5 rounded-sm ${BOOKING_DOT_CLASSES[s]}`} />
            {BOOKING_STATE_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
