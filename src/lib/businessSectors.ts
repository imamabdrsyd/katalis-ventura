/**
 * Helper klasifikasi sektor bisnis untuk fitur yang spesifik sektor.
 *
 * Kalender booking kamar (nightly stays) hanya relevan untuk sektor akomodasi —
 * bisnis jasa lain (personal care, agency) pakai model appointment yang berbeda
 * (belum tersedia). Gunakan helper ini, jangan hardcode string di banyak tempat.
 */

/** Sektor yang memakai model booking menginap per-malam. */
export const ACCOMMODATION_SECTORS = ['accommodation', 'short_term_rental'] as const;

export function isAccommodationSector(sector: string | null | undefined): boolean {
  return sector === 'accommodation' || sector === 'short_term_rental';
}
