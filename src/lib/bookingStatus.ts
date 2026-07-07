import type { Booking, BookingStatus, BookingChannel } from '@/types';

/**
 * Kelas warna & label untuk booking di kalender. Mengikuti AXION DS: pendapatan
 * terealisasi = emerald, dikonfirmasi = primary, tentatif = amber, batal = gray,
 * blok OTA impor = netral bergaris. Semua pasangan dark: disertakan.
 *
 * Catatan: status DB `completed` masih valid tapi TIDAK punya indikator terpisah —
 * booking `completed` ditampilkan by payment/konfirmasinya (Lunas/Dikonfirmasi),
 * karena "sudah dibayar" lebih informatif ketimbang menyembunyikannya jadi abu-abu.
 */

// State tampilan turunan dari status + payment_status + is_external.
export type BookingDisplayState =
  | 'paid'
  | 'confirmed'
  | 'checked_in'
  | 'tentative'
  | 'cancelled'
  | 'external';

export function getBookingDisplayState(b: Booking): BookingDisplayState {
  if (b.is_external) return 'external';
  if (b.status === 'cancelled') return 'cancelled';
  if (b.payment_status === 'paid') return 'paid';
  if (b.status === 'checked_in') return 'checked_in';
  if (b.status === 'tentative') return 'tentative';
  return 'confirmed';
}

// Bar di grid kalender (span menginap).
export const BOOKING_BAR_CLASSES: Record<BookingDisplayState, string> = {
  paid: 'bg-emerald-500 text-white dark:bg-emerald-600 dark:text-white',
  confirmed: 'bg-primary-500 text-white dark:bg-primary-600 dark:text-white',
  checked_in: 'bg-primary-600 text-white dark:bg-primary-500 dark:text-white',
  tentative: 'bg-amber-400 text-amber-950 dark:bg-amber-500 dark:text-amber-950',
  cancelled: 'bg-gray-200 text-gray-500 line-through dark:bg-gray-700 dark:text-gray-400',
  external: 'bg-gray-200 text-gray-600 border border-dashed border-gray-400 dark:bg-gray-700/60 dark:text-gray-300 dark:border-gray-500',
};

// Titik/badge ringkas (mis. legenda, KPI).
export const BOOKING_DOT_CLASSES: Record<BookingDisplayState, string> = {
  paid: 'bg-emerald-500',
  confirmed: 'bg-primary-500',
  checked_in: 'bg-primary-600',
  tentative: 'bg-amber-400',
  cancelled: 'bg-gray-300 dark:bg-gray-600',
  external: 'bg-gray-400',
};

export const BOOKING_STATE_LABELS: Record<BookingDisplayState, string> = {
  paid: 'Lunas',
  confirmed: 'Dikonfirmasi',
  checked_in: 'Check-in',
  tentative: 'Tentatif',
  cancelled: 'Dibatalkan',
  external: 'Blok OTA',
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  tentative: 'Tentatif',
  confirmed: 'Dikonfirmasi',
  checked_in: 'Check-in',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export const BOOKING_CHANNEL_LABELS: Record<BookingChannel, string> = {
  manual: 'Langsung',
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  website: 'Website',
  other: 'Lainnya',
};
