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

/**
 * Kategori usaha (`businesses.business_type`) — menentukan menu Katalog
 * (jasa → /calendar, produk & dagang → /point-of-sales), tipe item katalog, dan
 * label di BusinessSwitcher. Alasan sama seperti preset sektor di atas: satu
 * sumber saja. Dipakai `BusinessForm` (edit) dan `setup-business` (onboarding) —
 * dulu onboarding tidak mengirim field ini sama sekali sehingga kolomnya NULL
 * dan konsumen jatuh ke default yang berbeda-beda.
 */
export const BUSINESS_TYPE_PRESETS = [
  { value: 'jasa', label: 'Jasa' },
  { value: 'produk', label: 'Produk' },
  { value: 'dagang', label: 'Dagang' },
] as const;

export type BusinessTypePreset = (typeof BUSINESS_TYPE_PRESETS)[number]['value'];

/** Sektor yang memakai Asset Console (portofolio investasi konsolidasi). */
export const ASSET_CONSOLE_SECTORS = ['finance'] as const;

export function isAssetConsoleSector(sector: string | null | undefined): boolean {
  if (!sector) return false;
  const normalized = sector.trim().toLowerCase();
  return (ASSET_CONSOLE_SECTORS as readonly string[]).includes(normalized);
}

/**
 * Bisnis yang boleh menandai item katalog sebagai instrumen investasi (field
 * "Kelas Aset Investasi" + lot size di `CatalogItemForm`).
 *
 * Sengaja LEBIH SEMPIT dari `isAssetConsoleSector`: butuh sektor finance DAN
 * kategori usaha dagang. Bisnis produk/jasa biasa (F&B, personal care, agency)
 * tidak pernah memperjualbelikan saham/kripto lewat katalog — field itu cuma
 * memperpanjang form dan bikin bingung. Gating akses halaman Asset Console
 * tetap pakai `isAssetConsoleSector` (sektor saja) — dua pertanyaan berbeda:
 * "boleh lihat portofolio?" vs "boleh mendefinisikan instrumen baru?".
 */
export function isAssetCatalogBusiness(
  businessType: string | null | undefined,
  sector: string | null | undefined
): boolean {
  return isAssetConsoleSector(sector) && businessType?.trim().toLowerCase() === 'dagang';
}

/**
 * Sektor yang memakai modul Event Registration ("Book Your Spot", migr 136) —
 * pendaftaran event komunitas dengan tanggal kandidat & grid slot per tim.
 * Sengaja DIPASANGKAN dengan business_type 'jasa': sektor kreatif yang berjualan
 * produk tidak memakai model ini, dan bisnis jasa akomodasi tetap pakai kalender
 * booking per malam (isAccommodationSector) — dua model itu tidak boleh
 * bertabrakan di hub /calendar yang sama.
 */
export const EVENT_REGISTRATION_SECTORS = ['creative_agency'] as const;

export function supportsEventRegistration(
  businessType: string | null | undefined,
  sector: string | null | undefined
): boolean {
  if (!sector) return false;
  if ((businessType ?? '').trim().toLowerCase() !== 'jasa') return false;
  return (EVENT_REGISTRATION_SECTORS as readonly string[]).includes(sector.trim().toLowerCase());
}
