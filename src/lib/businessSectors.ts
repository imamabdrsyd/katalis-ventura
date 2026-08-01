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

/**
 * Daftar preset sektor bisnis — SATU sumber untuk dropdown `BusinessForm` dan
 * gating fitur spesifik-sektor (mis. Asset Console). `businesses.business_sector`
 * di DB tetap kolom TEXT bebas (opsi "Lainnya (Custom)" mengizinkan free-text di
 * luar daftar ini), tapi preset resmi WAJIB didefinisikan di sini saja — jangan
 * duplikasi literal value di file lain, supaya rename/typo di satu tempat tidak
 * diam-diam memutus fitur di tempat lain (kasus nyata: 'finance' sempat hardcode
 * terpisah di navigation.ts tanpa terikat ke daftar preset ini).
 */
export const BUSINESS_SECTOR_PRESETS = [
  { value: 'agribusiness', label: 'Agribusiness' },
  { value: 'personal_care', label: 'Personal Care' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'creative_agency', label: 'Creative Agency' },
  { value: 'food_and_beverage', label: 'F&B' },
  { value: 'finance', label: 'Finance' },
] as const;

export type BusinessSectorPreset = (typeof BUSINESS_SECTOR_PRESETS)[number]['value'];

/** Sektor yang memakai Asset Console (portofolio investasi konsolidasi). */
export const ASSET_CONSOLE_SECTORS = ['finance'] as const;

export function isAssetConsoleSector(sector: string | null | undefined): boolean {
  if (!sector) return false;
  const normalized = sector.trim().toLowerCase();
  return (ASSET_CONSOLE_SECTORS as readonly string[]).includes(normalized);
}
