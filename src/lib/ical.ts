/**
 * Parser & generator iCalendar (.ics) minimal untuk sinkronisasi ketersediaan
 * dengan OTA (Airbnb, Booking.com). Feed OTA hanya berisi VEVENT berbasis
 * tanggal (all-day) — cukup ekstrak DTSTART/DTEND/UID/SUMMARY. Tidak menarik
 * dependency eksternal agar aman di serverless.
 */

import type { BookingChannel } from '@/types';

export interface IcalEvent {
  uid: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (eksklusif — hari checkout)
  summary: string;
}

/** Unfold RFC 5545: baris lanjutan diawali spasi/tab setelah CRLF. */
function unfold(text: string): string {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

/** `20260712` atau `20260712T140000Z` → `2026-07-12`. */
function toISODate(raw: string): string | null {
  const m = raw.match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Parse teks .ics → daftar event berbasis tanggal. Mengabaikan event tanpa
 * DTSTART/DTEND valid.
 */
export function parseIcsEvents(text: string): IcalEvent[] {
  const lines = unfold(text).split(/\r?\n/);
  const events: IcalEvent[] = [];
  let cur: Partial<IcalEvent> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur?.start && cur.end) {
        events.push({
          uid: cur.uid || `${cur.start}_${cur.end}`,
          start: cur.start,
          end: cur.end,
          summary: cur.summary || '',
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const namePart = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const name = namePart.split(';')[0].toUpperCase();

    if (name === 'DTSTART') cur.start = toISODate(value) ?? cur.start;
    else if (name === 'DTEND') cur.end = toISODate(value) ?? cur.end;
    else if (name === 'UID') cur.uid = value.trim();
    else if (name === 'SUMMARY') cur.summary = value.trim();
  }

  return events;
}

/** Deteksi channel dari URL feed OTA. */
export function detectChannelFromUrl(url: string): BookingChannel {
  const u = url.toLowerCase();
  if (u.includes('airbnb')) return 'airbnb';
  if (u.includes('booking.com') || u.includes('admin.booking')) return 'booking_com';
  return 'other';
}

function ymd(iso: string): string {
  return iso.replace(/-/g, '');
}

function dtstamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escape teks sesuai RFC 5545 (koma, titik-koma, backslash, newline). */
function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export interface IcalGenerateInput {
  calName: string;
  events: IcalEvent[];
}

/** Bangun teks VCALENDAR dari daftar event (semua all-day). */
export function generateIcs({ calName, events }: IcalGenerateInput): string {
  const now = dtstamp();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AXION//Calendar//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
  ];

  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${ymd(ev.start)}`,
      `DTEND;VALUE=DATE:${ymd(ev.end)}`,
      `SUMMARY:${escapeText(ev.summary || 'Reserved')}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
