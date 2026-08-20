'use client';

/**
 * Kartu "Book Your Spot" di halaman publik `/[slug]` — pintu masuk ke Lobby.
 *
 * Mengikuti bahasa visual kartu widget reservasi yang sudah ada
 * (OmnichannelWidget): kartu putih rounded-xl dengan shadow lembut dan tombol
 * berwarna brand pemilik, bukan pola baru yang berdiri sendiri.
 *
 * Isinya sengaja cuma ringkasan sisa kuota per tanggal — pemilihan slot terjadi
 * di Lobby, yang butuh layar penuh untuk grid tim × player.
 */

import Link from 'next/link';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { DEFAULT_BRAND_COLOR, brandGradient, readableTextColor } from '@/lib/colorUtils';
import type { PublicEventSummary } from './types';

interface Props {
  event: PublicEventSummary;
  slug: string;
  buttonColor?: string | null;
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(`${iso}T00:00:00`)
  );
}

export function OmnichannelEventCard({ event, slug, buttonColor }: Props) {
  const accent = buttonColor ?? DEFAULT_BRAND_COLOR;

  const totalTaken = event.dates.reduce((sum, d) => sum + d.taken, 0);
  const totalCapacity = event.capacity * event.dates.length;
  const allFull = totalCapacity > 0 && totalTaken >= totalCapacity;

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-lg shadow-gray-200/60 dark:shadow-gray-900/60">
      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accent }}>
        Book Your Spot
      </p>
      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-1">{event.title}</h3>
      {event.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
          {event.description}
        </p>
      )}

      {/* Daftar tanggal + sisa kuota: alasan utama orang menekan kartu ini */}
      <div className="mt-4 space-y-2">
        {event.dates.slice(0, 4).map((date, index) => {
          const isFull = date.taken >= event.capacity;
          const pct = event.capacity > 0 ? Math.min(100, (date.taken / event.capacity) * 100) : 0;

          return (
            <div key={date.id} className="flex items-center gap-3">
              <CalendarDays className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-200 w-[104px] shrink-0">
                {formatShortDate(date.event_date)}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className="animate-bar-grow h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isFull ? '#10b981' : accent,
                    animationDelay: `${index * 70}ms`,
                  }}
                />
              </div>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
                {isFull ? 'Penuh' : `${date.taken}/${event.capacity}`}
              </span>
            </div>
          );
        })}
        {event.dates.length > 4 && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 pl-7">
            +{event.dates.length - 4} tanggal lain
          </p>
        )}
      </div>

      <Link
        href={`/${slug}/events/${event.id}`}
        className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 px-4 rounded-xl shadow-sm hover:shadow-md hover:brightness-110 active:scale-[0.98] motion-reduce:transform-none transition-all duration-150"
        style={{ background: brandGradient(accent), color: readableTextColor(accent) }}
      >
        {allFull ? 'Lihat daftar player' : 'Pilih tanggal & kunci slot'}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
