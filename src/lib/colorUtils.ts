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
 * Bias ke arah teks gelap saat kedua pilihan sama-sama lemah. Warna pastel
 * medium (mis. plum #9b6a8f) memberi ~4.3:1 vs putih dan ~4.1:1 vs gelap —
 * "menang tipis" secara angka, tapi tetap buram di layar HP karena kontrasnya
 * mepet ambang AA (4.5:1). Teks GELAP di warna borderline seperti itu masih
 * terasa jauh lebih tajam meski kalah tipis di hitungan murni, karena mata
 * lebih toleran pada teks gelap-di-warna dibanding teks terang-di-warna pada
 * kontras yang setara. 1.08 dipilih empiris: cukup untuk memenangkan gelap
 * pada rentang 4.0–4.5 tanpa membalik kasus yang memang jelas condong terang
 * (mis. hitam pekat, di mana margin kontrasnya jauh lebih besar dari 8%).
 */
const DARK_TEXT_BIAS = 1.08;

/**
 * Warna teks yang paling terbaca di atas `hex`: pilih yang rasio kontrasnya
 * lebih tinggi antara putih dan near-black, dengan bias tipis ke gelap saat
 * keduanya berdekatan (lihat DARK_TEXT_BIAS).
 *
 * Sengaja BUKAN ambang luminansi sederhana. Kuning #eab308 luminansinya 0,50 —
 * di bawah ambang 0,5-an mana pun yang wajar, jadi aturan ambang memberinya teks
 * putih dengan kontras 1,9:1 (praktis tak terbaca), padahal teks gelap di warna
 * yang sama mencapai 9,5:1. Warna brand datang bebas dari owner, jadi keputusan
 * ini harus dihitung per warna, bukan ditebak.
 */
export function readableTextColor(hex: string): typeof TEXT_LIGHT | typeof TEXT_DARK {
  const vsLight = contrastRatio(hex, TEXT_LIGHT);
  const vsDark = contrastRatio(hex, TEXT_DARK);
  return vsLight >= vsDark * DARK_TEXT_BIAS ? TEXT_LIGHT : TEXT_DARK;
}

/** Campur `hex` dengan hitam sebesar `percent` (0–100, sama seperti color-mix in srgb). */
function mixWithBlack(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const mix = (channel: number) => Math.round((channel * percent) / 100);
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHex(mix(rgb.r))}${toHex(mix(rgb.g))}${toHex(mix(rgb.b))}`;
}

/**
 * Sama seperti `readableTextColor`, tapi untuk teks yang duduk di atas SELURUH
 * `brandGradient(hex)` — bukan cuma titik atasnya.
 *
 * Bug nyata yang ditutup fungsi ini: untuk warna gelap-medium (mis. plum
 * `#b3729d`), titik ATAS gradien menang tipis ke teks gelap (4.91:1 vs
 * 3.61:1), tapi titik BAWAH gradien (82% campur hitam → `#935d81`, lebih
 * gelap dari titik atas) membalik keputusannya — teks gelap di situ cuma
 * 3.48:1 (gagal AA), sementara putih 5.09:1. `readableTextColor(hex)` yang
 * cuma menghitung dari titik atas memilih gelap dan tombolnya jadi buram di
 * bagian bawah, persis kasus yang dilaporkan user.
 *
 * Keputusannya diambil dari titik yang KONTRASNYA PALING BURUK terhadap
 * kandidat teks — bukan rata-rata, karena teks tetap harus terbaca di titik
 * terlemahnya, bukan cuma "cukup terbaca secara rata-rata".
 */
export function readableTextColorOnGradient(hex: string): typeof TEXT_LIGHT | typeof TEXT_DARK {
  const bottom = mixWithBlack(hex, 82);
  // TANPA DARK_TEXT_BIAS di sini — itu bias untuk kasus warna SOLID (satu
  // titik), dan justru salah dipakai di sini: mengambil titik TERLEMAH dari
  // dua ujung gradien sudah dengan sendirinya lebih ketat daripada mengevaluasi
  // satu warna, jadi menambah bias 8% lagi bisa MEMBALIK keputusan yang benar.
  // Kasus nyata: #b3729d worst-case putih 3.61 vs worst-case gelap 3.48 (putih
  // menang) — dengan bias 8% syaratnya jadi 3.61 >= 3.76 (gagal), jatuh ke
  // gelap yang salah, persis bug yang dilaporkan user di tombol event card.
  const worstVsLight = Math.min(contrastRatio(hex, TEXT_LIGHT), contrastRatio(bottom, TEXT_LIGHT));
  const worstVsDark = Math.min(contrastRatio(hex, TEXT_DARK), contrastRatio(bottom, TEXT_DARK));
  return worstVsLight >= worstVsDark ? TEXT_LIGHT : TEXT_DARK;
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


/** Override manual "hitam atau putih" untuk teks chip — lihat resolveTeamTextColor. */
export type TextColorOverride = 'light' | 'dark';

/**
 * Warna teks chip tim: pakai override manual owner bila ada (klik chip untuk
 * toggle — lihat EventSessionModal), kalau tidak hitung otomatis dari kontras
 * warna latarnya (readableTextColor).
 *
 * Override HANYA menyimpan 'light'|'dark', bukan hex bebas — pilihannya
 * tetap dibatasi ke dua opsi yang sudah pasti terbaca (putih murni / near-
 * black), owner cuma memilih yang mana, bukan mengetik warna arbitrer yang
 * bisa tak terbaca sama sekali.
 */
export function resolveTeamTextColor(
  backgroundHex: string,
  override: TextColorOverride | undefined
): typeof TEXT_LIGHT | typeof TEXT_DARK {
  if (override === 'light') return TEXT_LIGHT;
  if (override === 'dark') return TEXT_DARK;
  return readableTextColor(backgroundHex);
}

/** Toggle: dari warna teks yang SEDANG tampil, pindah ke lawannya. */
export function toggleTextColorOverride(currentTextColor: string): TextColorOverride {
  return currentTextColor === TEXT_LIGHT ? 'dark' : 'light';
}
