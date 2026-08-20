/**
 * Util warna untuk elemen yang warnanya DITENTUKAN PEMILIK BISNIS (warna brand
 * halaman publik, warna tim event) — bukan untuk token UI aplikasi. Token UI
 * tetap lewat kelas Tailwind `primary-*` / `gray-*` (lihat docs/DESIGN_SYSTEM.md).
 *
 * Warna brand datang sebagai hex bebas, jadi tidak ada jaminan kontras: teks
 * putih di atas kuning terang tak terbaca. Helper di sini yang menentukan warna
 * teks dan turunan tint/shade-nya.
 */

/** Warna brand default aplikasi (primary-500 / indigo-500). */
export const DEFAULT_BRAND_COLOR = '#6366f1';

/** Hex 3 atau 6 digit dengan '#'. Nilai di luar ini dianggap belum selesai diketik. */
export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

/** Normalisasi ke bentuk `#rrggbb` huruf kecil; null bila bukan hex valid. */
export function normalizeHexColor(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!isValidHexColor(v)) return null;
  if (v.length === 4) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return v;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

/** Relative luminance (WCAG 2.1) — 0 = hitam, 1 = putih. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** Rasio kontras WCAG antara dua warna (1 = identik, 21 = hitam vs putih). */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const TEXT_LIGHT = '#ffffff';
const TEXT_DARK = '#111827';

/**
 * Warna teks yang paling terbaca di atas `hex`: pilih yang rasio kontrasnya
 * lebih tinggi antara putih dan near-black.
 *
 * Sengaja BUKAN ambang luminansi sederhana. Kuning #eab308 luminansinya 0,50 —
 * di bawah ambang 0,5-an mana pun yang wajar, jadi aturan ambang memberinya teks
 * putih dengan kontras 1,9:1 (praktis tak terbaca), padahal teks gelap di warna
 * yang sama mencapai 9,5:1. Warna brand datang bebas dari owner, jadi keputusan
 * ini harus dihitung per warna, bukan ditebak.
 */
export function readableTextColor(hex: string): typeof TEXT_LIGHT | typeof TEXT_DARK {
  return contrastRatio(hex, TEXT_LIGHT) >= contrastRatio(hex, TEXT_DARK) ? TEXT_LIGHT : TEXT_DARK;
}

/** Versi transparan sebuah warna brand — untuk latar chip/banner lembut. */
export function tint(hex: string, percent: number): string {
  return `color-mix(in srgb, ${hex} ${percent}%, transparent)`;
}

/** Gradien tombol brand (sama seperti widget omnichannel: warna → 82% + hitam). */
export function brandGradient(hex: string): string {
  return `linear-gradient(to bottom, ${hex}, color-mix(in srgb, ${hex} 82%, #000))`;
}

/**
 * Preset yang ditawarkan color picker. Indigo (default aplikasi) di depan,
 * netral gelap & hitam di belakang — dua pilihan terakhir itu yang dipakai
 * bisnis yang mau tampilan netral, bukan warna brand.
 */
export const BRAND_COLOR_PRESETS = [
  '#6366f1', // indigo (default)
  '#8b5cf6', // violet
  '#9b6a8f', // plum
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#64748b', // slate
  '#111827', // near-black
  '#000000', // black
] as const;
