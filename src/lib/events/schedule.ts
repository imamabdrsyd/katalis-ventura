/**
 * Perapihan jam & lokasi event (migr 144) jadi satu baris siap tampil.
 *
 * Dipakai bersama oleh Lobby publik dan Event Manager, jadi "19:00–21:00 di GOR
 * Sukapura" tidak pernah dirender dengan dua aturan berbeda di dua tempat.
 *
 * Postgres mengirim TIME sebagai "HH:MM:SS" — detiknya tidak pernah berarti
 * untuk jadwal main, jadi dipotong di sini, sekali.
 */

/** "19:00:00" → "19:00". Nilai yang bukan jam dikembalikan apa adanya. */
export function formatEventTime(time: string | null | undefined): string {
  const trimmed = time?.trim();
  if (!trimmed) return '';
  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (!match) return trimmed;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/**
 * Rentang jam. Tanpa jam selesai → jam mulai saja (bukan "19:00–"), karena
 * end_time NULL memang berarti "sampai selesai", bukan data yang hilang.
 * En dash, bukan hyphen: ini rentang, bukan pemisah.
 */
export function formatEventTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): string {
  const start = formatEventTime(startTime);
  if (!start) return '';
  const end = formatEventTime(endTime);
  return end ? `${start}–${end}` : start;
}

/**
 * Baris "lokasi · jam" untuk header Lobby. Lokasi didahulukan: pendaftar yang
 * sedang menimbang mau ikut atau tidak menyaring tempat lebih dulu, jamnya baru
 * jadi pertimbangan kedua. Salah satu boleh kosong — pemisah ikut hilang, dan
 * kalau dua-duanya kosong hasilnya string kosong (pemanggil yang memutuskan
 * teks penggantinya).
 */
export function formatEventSchedule(
  location: string | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined
): string {
  return [location?.trim() ?? '', formatEventTimeRange(startTime, endTime)].filter(Boolean).join(' · ');
}
