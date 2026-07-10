'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import {
  addDays,
  parseISO,
  format,
  differenceInCalendarDays,
  isSameMonth,
  isToday,
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Link } from 'lucide-react';
import type { Booking } from '@/types';
import type { NightRate } from '@/lib/rates';
import {
  getBookingDisplayState,
  BOOKING_BAR_CLASSES,
  BOOKING_DOT_CLASSES,
  type BookingDisplayState,
} from '@/lib/bookingStatus';
import { useLanguage } from '@/context/LanguageContext';

const LEGEND: BookingDisplayState[] = ['confirmed', 'paid', 'tentative', 'external'];
const LANE_H = 24; // tinggi bar + gap
const HEADER_H = 42; // ruang untuk baris angka tanggal + harga (bar mulai di bawahnya)

/** Format harga ringkas untuk sel kalender: 350000 → "350rb", 1500000 → "1,5jt". */
function formatPriceShort(price: number): string {
  if (price >= 1_000_000) {
    const jt = price / 1_000_000;
    return `${jt.toLocaleString('id-ID', { maximumFractionDigits: 1 })}jt`;
  }
  if (price >= 1_000) return `${Math.round(price / 1_000)}rb`;
  return String(price);
}

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
  onJump: (year: number, month: number) => void;
  onOpenSync: () => void;
  /** Set harga inline aktif (unit punya sumber harga). Sel KOSONG & hari-ini-ke-depan
   *  bisa diklik utk pilih tanggal & set harga; booking tetap read-only. */
  pricingEnabled?: boolean;
  /** Harga final per tanggal (null = kalender harga belum dikonfigurasi → kolom harga disembunyikan). */
  priceOf?: (dateISO: string) => NightRate | null;
  /** Tanggal terpilih utk set harga (highlight sel). */
  selectedDates?: Set<string>;
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
  onJump,
  onOpenSync,
  pricingEnabled = false,
  priceOf,
  selectedDates,
}: CalendarBoardProps) {
  const { t, locale } = useLanguage();
  const c = t.calendar;
  const dfnsLocale = locale === 'id' ? idLocale : undefined;
  // Label state booking (legenda + tooltip). Selaras urutan getBookingDisplayState.
  const stateLabel: Record<BookingDisplayState, string> = {
    confirmed: c.stateConfirmed,
    paid: c.statePaid,
    checked_in: c.stateConfirmed,
    tentative: c.stateInquiry,
    cancelled: c.stateConfirmed,
    external: c.stateExternal,
  };
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [pickerOpen]);

  const todayISO = format(new Date(), 'yyyy-MM-dd');
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

  // Harga per-malam dari booking yg meng-cover tiap tanggal (menggantikan harga
  // katalog default di sel) + set tanggal yang sudah dibooking (utk cegah set
  // harga di tanggal terisi). Malam yg dibooking = check_in .. check_out-1.
  // Blok OTA (is_external) tetap dihitung "terisi" tapi tak punya harga tampil.
  //
  // Harga di sel jadi HIJAU hanya utk booking LUNAS (paid) — indikator "revenue
  // terkunci di pembukuan". Confirmed/Inquiry tidak mewarnai harga (chip-nya yg
  // membawa warna indigo/kuning; harga tetap default abu-abu). `paidPriceByDate`
  // hanya diisi booking paid; `bookedDates` tetap semua booking aktif (blokir set
  // harga di tanggal terisi apa pun statusnya).
  const { paidPriceByDate, bookedDates } = useMemo(() => {
    const priceMap = new Map<string, number>();
    const dateSet = new Set<string>();
    for (const b of bookings) {
      if (!b.check_in || !b.check_out) continue;
      if (b.status === 'cancelled') continue;
      const isPaid = !b.is_external && b.payment_status === 'paid' && b.price_per_night > 0;
      let cur = parseISO(b.check_in);
      const end = parseISO(b.check_out); // eksklusif (malam terakhir = check_out-1)
      let guard = 0;
      while (cur < end && guard < 400) {
        const iso = format(cur, 'yyyy-MM-dd');
        dateSet.add(iso);
        if (isPaid) priceMap.set(iso, b.price_per_night);
        cur = addDays(cur, 1);
        guard += 1;
      }
    }
    return { paidPriceByDate: priceMap, bookedDates: dateSet };
  }, [bookings]);

  return (
    <div className="card-static p-0 overflow-hidden">
      {/* Toolbar bulan */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label={c.prevMonth}
            className="btn-icon"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="flex items-center gap-1 min-w-[9rem] justify-center px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-haspopup="true"
              aria-expanded={pickerOpen}
              title={c.pickMonthYear}
            >
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 capitalize">
                {format(monthCursor, 'MMMM yyyy', { locale: dfnsLocale })}
              </h2>
            </button>
            {pickerOpen && (
              <MonthYearPicker
                monthCursor={monthCursor}
                monthLabels={c.monthsShort}
                prevYearLabel={c.prevYear}
                nextYearLabel={c.nextYear}
                onPick={(y, m) => {
                  onJump(y, m);
                  setPickerOpen(false);
                }}
              />
            )}
          </div>
          <button type="button" onClick={onNext} aria-label={c.nextMonth} className="btn-icon">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={onToday} className="btn-ghost ml-1 px-3 py-1.5 text-xs">
            {c.today}
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenSync}
          className="btn-ghost inline-flex items-center gap-1.5"
          title={c.connectWebsiteTitle}
        >
          <Link className="w-4 h-4" /> <span className="hidden sm:inline">{c.connectWebsite}</span>
        </button>
      </div>

      {/* Header hari */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {c.weekdays.map((w) => (
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

          // Booking yang beririsan minggu ini (yang di penampungan / tanpa tanggal
          // tidak digambar di grid — muncul di panel "Perlu tindak lanjut").
          const weekBookings = bookings
            .filter(
              (b): b is Booking & { check_in: string; check_out: string } =>
                b.check_in != null && b.check_out != null &&
                b.check_in < weekEndExclusiveStr && b.check_out > weekStartStr
            )
            .sort((a, b) => a.check_in.localeCompare(b.check_in) || (b.nights ?? 0) - (a.nights ?? 0));

          // Lane assignment (greedy) agar bar tidak bertumpuk
          const lanes: (Booking & { check_in: string; check_out: string })[][] = [];
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
              className="relative border-b border-gray-200 dark:border-gray-700 last:border-b-0"
            >
              {/* Sel hari (base layer). Klik = pilih tanggal utk set harga — HANYA
                  sel kosong (belum dibooking) & hari-ini-ke-depan. Booking di-klik
                  lewat bar overlay (buka detail). */}
              <div className="grid grid-cols-7" style={{ minHeight: cellMinH }}>
                {week.map((day, di) => {
                  const iso = format(day, 'yyyy-MM-dd');
                  const inMonth = isSameMonth(day, monthCursor);
                  const today = isToday(day);
                  const rate = priceOf?.(iso) ?? null;
                  // Bila tanggal ini di-cover booking LUNAS, tampilkan harga/malam
                  // booking tsb (hijau). Confirmed/Inquiry tidak → harga default.
                  const paidPrice = paidPriceByDate.get(iso) ?? null;
                  const displayPrice = paidPrice ?? rate?.price ?? null;
                  // Set harga hanya di tanggal KOSONG & hari-ini-ke-depan.
                  const clickable = pricingEnabled && !bookedDates.has(iso) && iso >= todayISO;
                  const selected = selectedDates?.has(iso) ?? false;
                  return (
                    <button
                      key={di}
                      type="button"
                      onClick={clickable ? () => onDayClick(iso) : undefined}
                      tabIndex={clickable ? 0 : -1}
                      className={`flex flex-col items-stretch text-left px-2 py-1.5 border-r border-gray-200 dark:border-gray-700 last:border-r-0 transition-colors ${
                        selected
                          ? 'bg-primary-50 dark:bg-primary-900/30 ring-1 ring-inset ring-primary-300 dark:ring-primary-700'
                          : `${clickable ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer' : 'cursor-default'} ${
                              inMonth ? 'bg-transparent' : 'bg-gray-50/60 dark:bg-gray-900/30'
                            }`
                      }`}
                      title={clickable ? c.setPriceCellTitle : undefined}
                    >
                      <span className="flex items-center justify-between gap-1">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                            today
                              ? 'bg-gray-900 text-white font-bold dark:bg-white dark:text-gray-900'
                              : inMonth
                                ? 'text-gray-700 dark:text-gray-200'
                                : 'text-gray-300 dark:text-gray-600'
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {displayPrice != null && (
                          <span
                            className={`text-[10px] tabular-nums truncate ${
                              paidPrice != null
                                ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                                : rate?.overridden
                                  ? 'font-semibold text-primary-600 dark:text-primary-400'
                                  : inMonth
                                    ? 'text-gray-400 dark:text-gray-500'
                                    : 'text-gray-300 dark:text-gray-600'
                            }`}
                            title={paidPrice != null ? c.bookingPriceTitle : undefined}
                          >
                            {formatPriceShort(displayPrice)}
                          </span>
                        )}
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
                  const label = b.guest_name || b.contact?.name || c.defaultBooking;

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
                      className={`pointer-events-auto min-w-0 truncate px-2.5 text-[11px] leading-[18px] font-medium transition-colors ${
                        BOOKING_BAR_CLASSES[state]
                      } ${isRealStart ? 'rounded-l-full ml-0.5' : ''} ${
                        isRealEnd ? 'rounded-r-full mr-0.5' : ''
                      } ${b.date_estimated ? 'ring-1 ring-inset ring-amber-400 dark:ring-amber-300' : ''}`}
                    >
                      {b.date_estimated ? '~' : ''}
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        {LEGEND.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className={`w-2.5 h-2.5 rounded-sm ${BOOKING_DOT_CLASSES[s]}`} />
            {stateLabel[s]}
          </span>
        ))}
        {priceOf && (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="text-[10px] font-semibold text-primary-600 dark:text-primary-400">350rb</span>
            {c.basePrice}
          </span>
        )}
      </div>
    </div>
  );
}

/** Dropdown pilih bulan (grid 3×4) + navigasi tahun. */
function MonthYearPicker({
  monthCursor,
  monthLabels,
  prevYearLabel,
  nextYearLabel,
  onPick,
}: {
  monthCursor: Date;
  monthLabels: string[];
  prevYearLabel: string;
  nextYearLabel: string;
  onPick: (year: number, month: number) => void;
}) {
  const [year, setYear] = useState(monthCursor.getFullYear());
  const curM = monthCursor.getMonth();
  const curY = monthCursor.getFullYear();
  const now = new Date();

  return (
    <div className="absolute z-30 top-full left-1/2 -translate-x-1/2 mt-1 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-3">
      {/* Navigasi tahun */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setYear((y) => y - 1)}
          className="btn-icon"
          aria-label={prevYearLabel}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">{year}</span>
        <button
          type="button"
          onClick={() => setYear((y) => y + 1)}
          className="btn-icon"
          aria-label={nextYearLabel}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {/* Grid bulan */}
      <div className="grid grid-cols-3 gap-1.5">
        {monthLabels.map((label, m) => {
          const isCurrent = m === curM && year === curY;
          const isThisMonth = m === now.getMonth() && year === now.getFullYear();
          return (
            <button
              key={m}
              type="button"
              onClick={() => onPick(year, m)}
              className={`py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isCurrent
                  ? 'bg-primary-500 text-white'
                  : isThisMonth
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
