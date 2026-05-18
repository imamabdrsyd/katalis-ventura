import type { OcrParsed } from './types';

type TransactionCategory = 'EARN' | 'OPEX' | 'VAR' | 'CAPEX' | 'TAX' | 'FIN';

const MONTH_MAP: Record<string, number> = {
  jan: 1, januari: 1,
  feb: 2, februari: 2,
  mar: 3, maret: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6,
  jul: 7, juli: 7,
  agu: 8, ags: 8, agustus: 8, aug: 8,
  sep: 9, september: 9,
  okt: 10, oktober: 10, oct: 10,
  nov: 11, november: 11,
  des: 12, desember: 12, dec: 12,
};

/**
 * Parse tanggal dari teks struk. Support format:
 * - dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
 * - yyyy-mm-dd
 * - "12 Mei 2026", "12 Mei 26"
 * Return ISO YYYY-MM-DD atau undefined.
 */
export function parseDate(text: string): string | undefined {
  // ISO format yyyy-mm-dd (paling jelas, cek dulu)
  const iso = text.match(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // dd/mm/yyyy atau dd-mm-yyyy atau dd.mm.yyyy
  const numeric = text.match(
    /\b(0?[1-9]|[12]\d|3[01])[/\-.](0?[1-9]|1[0-2])[/\-.](20\d{2}|\d{2})\b/
  );
  if (numeric) {
    const [, d, m, yRaw] = numeric;
    const year = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // "12 Mei 2026" / "12 Mei 26" / "12 Mei"
  const monthNames = Object.keys(MONTH_MAP).join('|');
  const re = new RegExp(
    `\\b(0?[1-9]|[12]\\d|3[01])\\s+(${monthNames})(?:\\s+(20\\d{2}|\\d{2}))?\\b`,
    'i'
  );
  const named = text.match(re);
  if (named) {
    const [, d, monthRaw, yRaw] = named;
    const m = MONTH_MAP[monthRaw.toLowerCase()];
    const year = yRaw
      ? yRaw.length === 2 ? `20${yRaw}` : yRaw
      : String(new Date().getFullYear());
    return `${year}-${String(m).padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return undefined;
}

/**
 * Maksimal nominal yang realistic untuk satu transaksi UKM Indonesia.
 * 10 Miliar — kalau lebih dari ini, hampir pasti hasil OCR mis-baca (mis. nomor invoice).
 */
const MAX_REALISTIC_AMOUNT = 10_000_000_000;

const CURRENCY_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: 'IDR', pattern: /\b(rp|idr)\b/i },
  { code: 'SGD', pattern: /\b(sgd|s\$)\b/i },
  { code: 'EUR', pattern: /\b(eur)\b|€/i },
  { code: 'AUD', pattern: /\b(aud|a\$)\b/i },
  { code: 'JPY', pattern: /\b(jpy)\b|¥/i },
  { code: 'CNY', pattern: /\b(cny|rmb)\b|¥/i },
  { code: 'MYR', pattern: /\b(myr|rm)\b/i },
  { code: 'USD', pattern: /\b(usd|us\$)\b|\$/i },
];

/**
 * Pattern untuk skip line yang mengandung ID/nomor seri (bukan nominal).
 * Contoh: "INV-1778575615348", "REF: 12345", "No. Transaksi: ABC123".
 */
const ID_LINE_PATTERN = /\b(inv|ref|no|nomor|id)[.:\-#\s]+[a-z]*[\d\-]{6,}/i;

/**
 * Parse total nominal dari struk. Strategi berurutan:
 * 1. Cari baris dengan prefix "Rp" / "IDR" diikuti angka berformat IDR
 * 2. Cari baris dengan kata kunci "total"/"jumlah"/"bayar"
 * 3. Fallback: angka terbesar berformat IDR (punya separator titik/koma)
 *
 * Skip line yang terlihat seperti ID/nomor invoice/referensi.
 */
export function parseTotal(text: string): number | undefined {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const totalKeywords = /\b(grand\s*total|total\s*akhir|total\s*bayar|total\s*belanja|jumlah\s*bayar|total|jumlah|tagihan|amount\s*due|amount\s*paid|invoice\s*total)\b/i;
  const skipKeywords = /\b(sub\s*total|subtotal|kembali|kembalian|hemat|diskon|discount|ppn|tax|pajak|service|biaya|tunai|cash|bayar\s+dengan)\b/i;
  const currencyPrefix = /(?:\b(?:rp|idr|usd|sgd|eur|aud|jpy|cny|rmb|myr|rm)\b\.?\s*[\d.,]+|[$€¥£]\s*[\d.,]+)/i;

  const candidatesFromCurrency: number[] = [];
  const candidatesFromKeyword: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (ID_LINE_PATTERN.test(line)) continue;

    // Strategy 1: line dengan prefix Rp/IDR
    if (currencyPrefix.test(line) && !skipKeywords.test(line)) {
      const amount = extractFormattedNumber(line);
      if (amount && amount > 0 && amount <= MAX_REALISTIC_AMOUNT) {
        candidatesFromCurrency.push(amount);
      }
    }

    // Strategy 2: line dengan kata kunci total
    if (totalKeywords.test(line) && !skipKeywords.test(line)) {
      let amount = extractLargestNumber(line);
      if (!amount && i + 1 < lines.length && !ID_LINE_PATTERN.test(lines[i + 1])) {
        amount = extractLargestNumber(lines[i + 1]);
      }
      if (amount && amount > 0 && amount <= MAX_REALISTIC_AMOUNT) {
        candidatesFromKeyword.push(amount);
      }
    }
  }

  // Prefer kandidat dari prefix Rp/IDR — paling reliable
  if (candidatesFromCurrency.length > 0) {
    return Math.max(...candidatesFromCurrency);
  }
  if (candidatesFromKeyword.length > 0) {
    return Math.max(...candidatesFromKeyword);
  }

  // Strategy 3: fallback — angka terbesar yang BERFORMAT IDR (punya separator)
  let fallbackLargest = 0;
  for (const line of lines) {
    if (ID_LINE_PATTERN.test(line)) continue;
    const amount = extractFormattedNumber(line);
    if (amount && amount > fallbackLargest && amount <= MAX_REALISTIC_AMOUNT) {
      fallbackLargest = amount;
    }
  }
  return fallbackLargest >= 1000 ? fallbackLargest : undefined;
}

export function parseCurrency(text: string): string | undefined {
  for (const { code, pattern } of CURRENCY_PATTERNS) {
    if (pattern.test(text)) return code;
  }
  return undefined;
}

/**
 * Ekstrak angka dari string — support format IDR (ribuan) dan format asing (desimal USD).
 * "Rp 316.350" → 316350
 * "1.500.000" → 1500000
 * "$20.00" → 20
 * "USD 1,500.00" → 1500
 * "1778575615348" → undefined (no separator, kemungkinan ID)
 */
function extractFormattedNumber(s: string): number | undefined {
  // Format asing: $ / simbol currency diikuti angka dengan desimal (mis. $20.00, $1,500.00)
  const foreignMatch = s.match(/[$€¥£]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+\.\d{2})/);
  if (foreignMatch) {
    const raw = foreignMatch[1].replace(/,/g, '');
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }

  // Format IDR dengan separator ribuan
  const matches = s.matchAll(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?)/g);
  let largest = 0;
  for (const m of matches) {
    const num = normalizeNumber(m[1]);
    if (num !== undefined && num > largest) largest = num;
  }
  return largest > 0 ? largest : undefined;
}

/**
 * Ekstrak angka terbesar dari sebuah string. Handle:
 * - "150.000" → 150000 (Indonesian thousand separator)
 * - "150,000" → 150000
 * - "150.000,50" → 150000.50
 * - "Rp 1.500.000" → 1500000
 * - "1500000" → 1500000
 */
function extractLargestNumber(s: string): number | undefined {
  // Match angka dengan optional ribuan separator (./,) dan optional desimal
  const matches = s.matchAll(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d{4,}(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g);

  let largest = 0;
  for (const m of matches) {
    const raw = m[1];
    const num = normalizeNumber(raw);
    if (num !== undefined && num > largest) largest = num;
  }

  return largest > 0 ? largest : undefined;
}

/**
 * Normalisasi string angka Indonesia ke number.
 * Logic: jika ada DUA separator beda (mis. "1.500.000,50"), titik=ribuan, koma=desimal.
 * Jika cuma satu jenis separator, asumsi: tiga digit setelahnya = ribuan, selain itu desimal.
 */
function normalizeNumber(raw: string): number | undefined {
  if (!raw) return undefined;

  const hasDot = raw.includes('.');
  const hasComma = raw.includes(',');

  let cleaned: string;
  if (hasDot && hasComma) {
    const lastDot = raw.lastIndexOf('.');
    const lastComma = raw.lastIndexOf(',');
    if (lastComma > lastDot) {
      // "1.500.000,50" → titik = ribuan, koma = desimal
      cleaned = raw.replace(/\./g, '').replace(',', '.');
    } else {
      // "1,500,000.50" → koma = ribuan, titik = desimal
      cleaned = raw.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Cek: apakah koma diikuti tepat 1-2 digit di akhir? Jika ya = desimal
    const parts = raw.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = `${parts[0]}.${parts[1]}`;
    } else {
      // koma sebagai ribuan: "1,500,000"
      cleaned = raw.replace(/,/g, '');
    }
  } else if (hasDot) {
    const parts = raw.split('.');
    // Jika ada >1 titik, pasti ribuan
    if (parts.length > 2) {
      cleaned = raw.replace(/\./g, '');
    } else if (parts.length === 2 && parts[1].length === 3) {
      // "150.000" — ambigu tapi di konteks IDR, ini ribuan
      cleaned = raw.replace(/\./g, '');
    } else if (parts.length === 2 && parts[1].length <= 2) {
      // "150.50" → desimal
      cleaned = raw;
    } else {
      cleaned = raw.replace(/\./g, '');
    }
  } else {
    cleaned = raw;
  }

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Pattern key:value yang sering muncul di struk digital (e-receipt).
 * Contoh: "Jenis Transaksi: Telkomsel", "Merchant: Tokopedia", "Toko: Indomaret"
 */
const MERCHANT_KEY_PATTERN = /^(?:jenis\s*transaksi|merchant|toko|penerima|kepada|to|provider|operator|nama\s*merchant|nama\s*toko|nama\s*penerima)\s*[:\-]\s*(.+)$/i;

/**
 * Parse vendor (nama toko/merchant) dari struk.
 * Strategi:
 * 1. Cari baris "Jenis Transaksi: X" / "Merchant: X" di seluruh teks
 * 2. Fallback: baris awal yang bukan angka/alamat/noise
 */
export function parseVendor(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Strategy 1: cari key:value pattern di SELURUH baris (bukan hanya 5 teratas)
  for (const line of lines) {
    const m = line.match(MERCHANT_KEY_PATTERN);
    if (m) {
      const val = m[1].trim().replace(/[*•\-_]+$/g, '').trim();
      // Strip leading single char + whitespace (mis. "A Anthropic" → "Anthropic" karena OCR baca logo)
      const cleaned = val.replace(/^[A-Za-z]\s+/, '').trim();
      if (cleaned.length >= 2 && !/^\d+$/.test(cleaned)) return cleaned;
    }
  }

  // Strategy 2: scan baris awal untuk nama toko eksplisit
  const topLines = lines.slice(0, 8); // perluas dari 5 ke 8 baris

  const skipPatterns = [
    /^\d/,                              // baris diawali angka
    /^(jl|jalan|alamat|no\.?\s*\d)/i,   // alamat
    /\b(telp|telepon|phone|hp|wa|whatsapp)\b[:.\s]/i,
    /npwp/i,
    /struk|receipt|invoice|kwitansi/i,
    /^[\W_]+$/,
    /^(thank\s*you|terima\s*kasih|tq|thanks|hello|hi|halo|selamat)\b/i,
    /\b(berhasil|successful|sukses|completed|complete|failed|gagal)\b/i,
    /^(rp|idr)\b/i,
    /\b(pembayaran|payment|transaksi|transaction|bill\s*payment)\b/i,
    /\b(purchase|order|nota|faktur)\b/i,
    /\b(periode|period|tanggal|date|waktu|time)\b[:.\s]/i,
    /\b(no|ref|id|kode)\b[.\s:#-]/i,   // reference number lines
  ];

  for (const line of topLines) {
    if (line.length < 2) continue;
    if (skipPatterns.some((p) => p.test(line))) continue;

    const cleaned = line.replace(/[*•\-_]+$/g, '').trim();
    // Strip leading single char + whitespace (mis. OCR baca logo sebagai single letter)
    const stripped = cleaned.replace(/^[A-Za-z]\s+/, '').trim();
    if (stripped.length >= 2) return stripped;
  }

  return undefined;
}

/**
 * Inferensi kategori transaksi berdasarkan nama vendor.
 * Hanya hint — user bisa override di form.
 */
const VENDOR_CATEGORY_RULES: Array<{ pattern: RegExp; category: TransactionCategory }> = [
  // Telekomunikasi & utilitas → OPEX
  { pattern: /\b(telkomsel|telkom|indosat|xl|axis|smartfren|bytelco|tri|3)\b/i, category: 'OPEX' },
  { pattern: /\b(pln|pdam|gas\s*negara|pgn)\b/i, category: 'OPEX' },
  { pattern: /\b(wifi|internet|speedy|fiber|indihome|biznet|myrepublic|firstmedia)\b/i, category: 'OPEX' },
  // Minimarket / supermarket → OPEX (bahan kantor / kebutuhan)
  { pattern: /\b(indomaret|alfamart|alfamidi|circle\s*k|lawson|familymart|7-?eleven|hypermart|lottemart|transmart|carrefour)\b/i, category: 'OPEX' },
  // Restoran / food → OPEX (biaya konsumsi)
  { pattern: /\b(mcdonald|kfc|burger\s*king|pizza\s*hut|domino|starbucks|kopi\s*kenangan|janji\s*jiwa|gofood|grabfood|shopeefood)\b/i, category: 'OPEX' },
  // Bahan baku / grosir → VAR
  { pattern: /\b(grosir|agen|supplier|indogrosir|makro|metro|lotte\s*grosir)\b/i, category: 'VAR' },
  // Pajak → TAX
  { pattern: /\b(pajak|ppn|pph|bpjs|samsat|bea\s*cukai)\b/i, category: 'TAX' },
  // Perjalanan dinas → OPEX
  { pattern: /\b(grab|gojek|gocar|goride|maxim|blue\s*bird|pertamina|shell|vivo|bp\b|total\s*oil)\b/i, category: 'OPEX' },
  // Bank / pinjaman → FIN
  { pattern: /\b(bca|bri|bni|mandiri|cimb|danamon|btpn|btn|maybank|ocbc|cicilan|angsuran|kredit)\b/i, category: 'FIN' },
  // E-wallet top-up → OPEX
  { pattern: /\b(ovo|dana|gopay|linkaja|shopeepay|sakuku|paytren)\b/i, category: 'OPEX' },
  // Marketplace pembelian barang → VAR (default ke HPP/variabel)
  { pattern: /\b(tokopedia|shopee|lazada|bukalapak|blibli|jd\.id)\b/i, category: 'VAR' },
];

export function inferCategory(vendor: string | undefined, rawText?: string): TransactionCategory | undefined {
  const haystack = [vendor ?? '', rawText ?? ''].join(' ').toLowerCase();
  for (const rule of VENDOR_CATEGORY_RULES) {
    if (rule.pattern.test(haystack)) return rule.category;
  }
  return undefined;
}

/**
 * Main parser: ambil { date, total, vendor, category } dari raw OCR text.
 */
export function parseReceipt(rawText: string): OcrParsed {
  const vendor = parseVendor(rawText);
  return {
    date: parseDate(rawText),
    total: parseTotal(rawText),
    currency_code: parseCurrency(rawText),
    vendor,
    category: inferCategory(vendor, rawText),
  };
}
