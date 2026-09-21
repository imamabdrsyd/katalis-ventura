/**
 * Merge konten dari DB di atas default yang ada di kode.
 *
 * Ini jaring pengaman utama Site CMS: halaman publik SELALU dirender dari
 * `merge(defaults, fromDb)`. Kalau baris DB kosong, satu key hilang karena
 * skema berkembang, atau JSONB-nya rusak sebagian, halaman tetap tampil utuh
 * memakai nilai kode. Landing page tidak pernah blank gara-gara CMS.
 *
 * ATURAN: object di-merge rekursif, ARRAY DIGANTI UTUH.
 *
 * Array sengaja tidak di-merge per elemen. Kalau array ikut di-merge, admin
 * tidak akan pernah bisa MENGHAPUS item — menghapus item ke-3 dari daftar
 * fitur akan memunculkan kembali item ke-3 milik default. Untuk `sectionOrder`
 * aturan ini juga yang membuat "sembunyikan section" benar-benar bekerja.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param defaults bentuk lengkap dari kode — menentukan key mana yang valid
 * @param override  isi parsial dari DB
 */
export function mergeSiteContent<T>(defaults: T, override: unknown): T {
  if (override === undefined || override === null) return defaults;

  // Array & skalar: nilai DB menang apa adanya.
  if (!isPlainObject(defaults) || !isPlainObject(override)) {
    // Tipe yang tidak cocok (mis. DB menyimpan string di tempat object karena
    // dokumen lama) — pertahankan default supaya renderer tidak meledak.
    if (isPlainObject(defaults) !== isPlainObject(override)) return defaults;
    return override as T;
  }

  const result: Record<string, unknown> = { ...defaults };

  for (const [key, overrideValue] of Object.entries(override)) {
    // Key yang tidak dikenal default diabaikan — mencegah dokumen lama
    // menyelundupkan field yang sudah dihapus dari skema.
    if (!(key in (defaults as Record<string, unknown>))) continue;

    const defaultValue = (defaults as Record<string, unknown>)[key];

    if (Array.isArray(defaultValue)) {
      result[key] = Array.isArray(overrideValue) ? overrideValue : defaultValue;
      continue;
    }

    if (isPlainObject(defaultValue)) {
      result[key] = mergeSiteContent(defaultValue, overrideValue);
      continue;
    }

    result[key] = overrideValue === undefined ? defaultValue : overrideValue;
  }

  return result as T;
}

/**
 * Perbandingan struktural untuk menandai "draft berbeda dari yang tayang".
 * Cukup untuk keperluan badge di admin — bukan diff yang ditampilkan per field.
 */
export function isSameContent(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

/** JSON.stringify dengan key terurut, supaya urutan key tidak dianggap perubahan. */
function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  return JSON.stringify(sortKeys(value as Json));
}

function sortKeys(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, Json>>((acc, key) => {
        acc[key] = sortKeys((value as Record<string, Json>)[key]);
        return acc;
      }, {});
  }
  return value;
}
