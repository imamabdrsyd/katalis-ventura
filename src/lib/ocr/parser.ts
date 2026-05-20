import type { OcrParsed, OcrLineItem, OcrCharge } from './types';

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
 * Label vendor yang sering muncul sebagai BARIS TERPISAH di e-receipt dua-kolom.
 * Layout: label di baris X, value di baris Y (dimulai dengan ":"). Lihat parseVendor strat 1b.
 */
const VENDOR_LABEL_LINE = /^(jenis\s*transaksi|transaction\s*type|merchant|nama\s*merchant|toko|nama\s*toko|penerima|nama\s*penerima|kepada|provider|operator)\s*[:.]?\s*$/i;

/**
 * Brand telco/utility yang sering muncul sebagai logo/header di struk.
 * Jika terdeteksi di teks, dipakai sebagai vendor candidate (skor tinggi karena reliable).
 */
const KNOWN_BRAND_PATTERN = /\b(telkomsel|indosat|xl\s*axiata|smartfren|by\.?u|tri|axis|indihome|biznet|myrepublic|firstmedia|pln|pdam|pgn|gojek|grab|tokopedia|shopee|lazada|bukalapak|blibli|indomaret|alfamart|alfamidi|mcdonald|kfc|starbucks|pertamina|shell)\b/i;

/**
 * Bersihkan kandidat vendor: strip karakter noise di awal/akhir & leading single-char (logo).
 */
function cleanVendorCandidate(raw: string): string {
  const trimmed = raw.trim().replace(/^[*•\-_:\s]+/, '').replace(/[*•\-_]+$/g, '').trim();
  // Strip leading single char + whitespace (mis. "A Anthropic" → "Anthropic" karena OCR baca logo)
  return trimmed.replace(/^[A-Za-z]\s+/, '').trim();
}

/**
 * Normalize casing — ubah ALL CAPS jadi Title Case agar lebih cocok dengan kontak yang
 * tersimpan. Hanya berlaku kalau string benar-benar semua huruf besar (≥ 3 char),
 * karena nama proper biasanya sudah Title Case dari sumbernya.
 */
function normalizeVendorCasing(raw: string): string {
  const letters = raw.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return raw;
  // Anggap "all caps" hanya jika tidak ada huruf kecil sama sekali
  if (/[a-z]/.test(raw)) return raw;
  return raw
    .toLowerCase()
    .replace(/\b([a-z])([a-z]*)/g, (_, first, rest) => first.toUpperCase() + rest);
}

/**
 * Parse vendor (nama toko/merchant) dari struk. Strategi berurutan:
 * 1. Inline key:value — "Jenis Transaksi: Telkomsel"
 * 2. Two-column layout — label di satu baris, value di baris ":Telkomsel" di bawah.
 *    Pair pertama dimana label = "Jenis Transaksi"/"Merchant"/dll dengan value pertama yang lewat.
 * 3. Brand pattern — scan SELURUH teks, cari nama brand telco/marketplace yang dikenal.
 * 4. Fallback — baris awal yang bukan noise.
 */
export function parseVendor(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Strategy 1: inline key:value
  for (const line of lines) {
    const m = line.match(MERCHANT_KEY_PATTERN);
    if (m) {
      const cleaned = cleanVendorCandidate(m[1]);
      if (cleaned.length >= 2 && !/^\d+$/.test(cleaned)) return normalizeVendorCasing(cleaned);
    }
  }

  // Strategy 2: two-column layout (label list di atas, value list ":..." di bawah).
  // Kumpulkan SEMUA label utama (yang tidak diikuti ":" inline), lalu pasangkan dengan
  // value lines (baris dimulai ":") secara berurutan. Ordinal label "Jenis Transaksi"
  // menentukan value mana yang dipakai sebagai vendor.
  const KNOWN_LABEL_LINE = /^(waktu\s*transaksi|transaction\s*time|jenis\s*transaksi|transaction\s*type|no\.?\s*transaksi|transaction\s*number|periode\s*tagihan|billing\s*period[e]?|no\.?\s*pelanggan|no\.?\s*customer|nama\s*pelanggan|customer'?s?\s*name|metode\s*bayar|payment\s*method|merchant|toko|provider|operator)\s*[:.]?\s*$/i;

  const orderedLabels: string[] = [];
  const orderedValues: string[] = [];

  for (const line of lines) {
    if (KNOWN_LABEL_LINE.test(line)) {
      orderedLabels.push(line.toLowerCase());
    } else if (/^:\s*\S/.test(line)) {
      orderedValues.push(line.replace(/^:\s*/, ''));
    }
  }
  // Cari ordinal label vendor (Jenis Transaksi / Merchant / dll)
  const vendorLabelIndex = orderedLabels.findIndex((l) => VENDOR_LABEL_LINE.test(l));
  if (vendorLabelIndex >= 0 && vendorLabelIndex < orderedValues.length) {
    const cleaned = cleanVendorCandidate(orderedValues[vendorLabelIndex]);
    if (cleaned.length >= 2 && !/^\d+$/.test(cleaned) && !ID_LINE_PATTERN.test(cleaned)) {
      return normalizeVendorCasing(cleaned);
    }
  }

  // Strategy 3: brand pattern — scan whole text for known telco/marketplace names
  const brandMatch = text.match(KNOWN_BRAND_PATTERN);
  if (brandMatch) {
    return normalizeVendorCasing(brandMatch[0].replace(/\s+/g, ' ').trim());
  }

  // Strategy 4: scan baris awal untuk nama toko eksplisit
  const topLines = lines.slice(0, 8);

  const skipPatterns = [
    /^\d/,                              // baris diawali angka
    /^:/,                               // value line di kolom kanan layout dua-kolom
    /^(jl|jalan|alamat|no\.?\s*\d)/i,   // alamat
    /\b(telp|telepon|phone|hp|wa|whatsapp)\b[:.\s]/i,
    /npwp/i,
    /struk|receipt|invoice|kwitansi/i,
    /^[\W_]+$/,
    /^(thank\s*you|terima\s*kasih|tq|thanks|hello|hi|halo|selamat)\b/i,
    /\b(berhasil|successful|sukses|successfull|completed|complete|failed|gagal)\b/i,
    /^(rp|idr)\b/i,
    /\b(pembayaran|payment|transaksi|transaction|bill\s*payment)\b/i,
    /\b(purchase|order|nota|faktur)\b/i,
    /\b(periode|period|tanggal|date|waktu|time)\b[:.\s]/i,
    /\b(no|ref|id|kode)\b[.\s:#-]/i,   // reference number lines
    /\b(detail|details)\b/i,           // "Detail Transaksi", "Transaction Details"
  ];

  for (const line of topLines) {
    if (line.length < 2) continue;
    if (skipPatterns.some((p) => p.test(line))) continue;
    const cleaned = cleanVendorCandidate(line);
    if (cleaned.length >= 2) return normalizeVendorCasing(cleaned);
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
 * Topic keyword groups. Each rule matches anywhere in the raw OCR text + vendor name,
 * and emits its `keywords` list — used by the matcher to find a Chart of Accounts entry
 * with overlapping wording (e.g. account named "Internet" / description "Wifi bulanan").
 *
 * Order is irrelevant; multiple groups can match (their keywords are merged & deduped).
 */
const KEYWORD_RULES: Array<{ pattern: RegExp; keywords: string[] }> = [
  // Telco / internet / WiFi (typo-tolerant for OCR errors: Inditiame, lndihome, etc.)
  {
    pattern: /\b(wifi|internet|indi\s*home|ind[il]ti?ame|biznet|myrepublic|firstmedia|first\s*media|speedy|fiber|eznet|ez\s*net)\b/i,
    keywords: ['internet', 'wifi', 'indihome', 'telkom'],
  },
  // Cellular pulsa / data
  {
    pattern: /\b(pulsa|paket\s*data|kuota|telkomsel|indosat|xl\s*axiata|axis|smartfren|tri\b|3\b|by\.?u)\b/i,
    keywords: ['pulsa', 'telepon', 'komunikasi', 'telkomsel', 'telkom', 'data'],
  },
  // Utilities
  { pattern: /\b(pln|listrik|token\s*listrik|electricity)\b/i, keywords: ['listrik', 'utilitas', 'pln'] },
  { pattern: /\b(pdam|air|water)\b/i, keywords: ['air', 'utilitas', 'pdam'] },
  { pattern: /\b(pgn|gas\s*negara|gas)\b/i, keywords: ['gas', 'utilitas'] },
  // Transport
  { pattern: /\b(grab|gojek|gocar|goride|maxim|blue\s*bird|taxi|taksi)\b/i, keywords: ['transportasi', 'transport', 'taxi'] },
  { pattern: /\b(pertamina|shell|vivo|bp|total\s*oil|bensin|solar|pertalite|pertamax)\b/i, keywords: ['bbm', 'bensin', 'bahan bakar'] },
  // Food
  { pattern: /\b(gofood|grabfood|shopeefood|mcdonald|kfc|burger|pizza|starbucks|kopi)\b/i, keywords: ['konsumsi', 'makan', 'food', 'meals'] },
  // Marketplaces / shopping
  { pattern: /\b(tokopedia|shopee|lazada|bukalapak|blibli|jd\.id)\b/i, keywords: ['pembelian', 'belanja', 'marketplace'] },
  // Minimarket
  { pattern: /\b(indomaret|alfamart|alfamidi|circle\s*k|lawson|familymart|7-?eleven|hypermart|lottemart|transmart|carrefour)\b/i, keywords: ['perlengkapan', 'belanja', 'supplies'] },
  // Tax
  { pattern: /\b(pajak|ppn|pph|samsat|bea\s*cukai)\b/i, keywords: ['pajak', 'tax'] },
  { pattern: /\b(bpjs)\b/i, keywords: ['bpjs', 'asuransi', 'jaminan'] },
  // Banking / loan
  { pattern: /\b(cicilan|angsuran|kredit|pinjaman|loan)\b/i, keywords: ['pinjaman', 'kredit', 'hutang'] },
  { pattern: /\b(bunga|interest)\b/i, keywords: ['bunga', 'interest'] },
  // E-wallet topup
  { pattern: /\b(top\s*up|topup|isi\s*saldo)\b/i, keywords: ['saldo', 'topup'] },
  { pattern: /\b(ovo|dana|gopay|linkaja|shopeepay|sakuku)\b/i, keywords: ['e-wallet', 'dompet digital'] },
];

/**
 * Fallback keyword per kategori transaksi — supaya match minimal nyangkut ke
 * default CoA seperti "Beban Operasional" / "HPP" / "Beban Pajak" kalau tidak
 * ada keyword spesifik yang cocok.
 */
const CATEGORY_FALLBACK_KEYWORDS: Record<TransactionCategory, string[]> = {
  OPEX: ['operasional', 'beban', 'biaya'],
  VAR: ['hpp', 'pokok', 'penjualan', 'persediaan'],
  TAX: ['pajak', 'beban pajak'],
  FIN: ['pembiayaan', 'pinjaman', 'modal'],
  CAPEX: ['aset', 'tetap', 'peralatan'],
  EARN: ['pendapatan', 'penjualan'],
};

/**
 * Ekstrak keyword semantik (spesifik) dari struk untuk matching ke Chart of Accounts.
 * Hasil: array kata kunci lowercase, deduped, urut sesuai urutan rule match.
 */
export function extractKeywords(vendor: string | undefined, rawText: string): string[] {
  const haystack = [vendor ?? '', rawText ?? ''].join(' ');
  const result: string[] = [];
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(haystack)) {
      for (const k of rule.keywords) {
        if (!result.includes(k)) result.push(k);
      }
    }
  }
  return result;
}

/**
 * Keyword fallback dari kategori transaksi — dipakai matcher dengan bobot lebih kecil
 * (cuma tie-breaker), supaya match minimal nyangkut ke default CoA tanpa mengalahkan
 * akun yang punya match spesifik.
 */
export function extractFallbackKeywords(vendor: string | undefined, rawText: string): string[] {
  const category = inferCategory(vendor, rawText);
  return category ? [...CATEGORY_FALLBACK_KEYWORDS[category]] : [];
}

/**
 * Pattern untuk skip baris yang BUKAN line item — header, footer, total, alamat, dll.
 * Dipakai di parseLineItems untuk eliminasi noise sebelum match item pattern.
 */
const LINE_ITEM_SKIP_PATTERN = /\b(sub\s*total|subtotal|grand\s*total|total\s*akhir|total\s*bayar|total\s*belanja|jumlah\s*bayar|total\b|jumlah\b|tagihan|amount\s*due|amount\s*paid|invoice\s*total|kembali|kembalian|hemat|diskon|discount|ppn|tax|pajak|service\s*charge|tunai|cash|bayar\s+dengan|kasir|cashier|npwp|telp|telepon|phone|alamat|address|jl\b|jalan|struk|receipt|invoice|kwitansi|nota|faktur|terima\s*kasih|thank\s*you|tanggal|date|waktu|time|no\.?\s*transaksi|no\.?\s*ref)\b/i;

/**
 * Pattern keyword untuk komponen biaya — dipakai parseCharges.
 */
const CHARGE_PATTERNS: Array<{ type: OcrCharge['type']; pattern: RegExp; keywords: string[] }> = [
  { type: 'tax', pattern: /\b(ppn|pajak|tax|pb1|pajak\s*restoran|service\s*tax|vat)\b/i, keywords: ['pajak', 'ppn', 'tax'] },
  { type: 'service', pattern: /\b(service\s*charge|biaya\s*layanan|biaya\s*service|service\s*fee)\b/i, keywords: ['biaya layanan', 'service'] },
  { type: 'discount', pattern: /\b(diskon|discount|potongan|promo|voucher)\b/i, keywords: ['diskon', 'potongan'] },
];

/**
 * Pattern line item — format umum di struk Indonesia:
 *   "Beras Premium 5kg     50.000"
 *   "2x  Indomie Goreng    7.000"
 *   "Sabun Lifebuoy 250ml  Rp 15.500"
 *   "Kopi Susu  1  25.000  25.000"  (deskripsi qty unit_price total)
 *
 * Strategi: cari baris yang mengandung minimal 1 angka berformat nominal di akhir,
 * didahului oleh teks deskriptif (≥ 3 char alfabet).
 */
const LINE_ITEM_PATTERN = /^(.+?)\s+(?:Rp\.?\s*)?((?:\d{1,3}(?:[.,]\d{3})+|\d{4,})(?:[.,]\d{1,2})?)\s*$/i;

/**
 * Pattern qty di awal item. Mendukung:
 *   "2x Indomie", "2 x Indomie", "2 Indomie", "2pcs Indomie"
 */
const QTY_PREFIX_PATTERN = /^(\d{1,3})\s*(?:x|pcs|pc|pack|btl|bks|kg|gr|ml|ltr|l)\b\s*(.+)$/i;

/**
 * Pattern baris "qty unit_price total" — biasanya 3 angka di akhir baris.
 *   "Kopi Susu   2  25.000   50.000"
 */
const QTY_PRICE_TOTAL_PATTERN = /^(.+?)\s+(\d{1,3})\s+((?:\d{1,3}(?:[.,]\d{3})+|\d{4,})(?:[.,]\d{1,2})?)\s+((?:\d{1,3}(?:[.,]\d{3})+|\d{4,})(?:[.,]\d{1,2})?)\s*$/i;

/**
 * Topical keyword rules untuk match akun per line item (mis. "Beras" → ["bahan pokok"]).
 * Lebih granular dari KEYWORD_RULES global karena dievaluasi per-item.
 */
const LINE_ITEM_KEYWORD_RULES: Array<{ pattern: RegExp; keywords: string[] }> = [
  { pattern: /\b(beras|gula|minyak|tepung|garam|telur|susu|kopi|teh|mie|indomie)\b/i, keywords: ['bahan pokok', 'sembako', 'konsumsi'] },
  { pattern: /\b(sabun|shampoo|pasta\s*gigi|deterjen|tissue|tisu|pewangi)\b/i, keywords: ['perlengkapan', 'kebersihan', 'supplies'] },
  { pattern: /\b(rokok|sampoerna|gudang\s*garam|djarum|marlboro|lucky)\b/i, keywords: ['rokok', 'konsumsi'] },
  { pattern: /\b(air\s*mineral|aqua|le\s*minerale|nestle|club|cleo|prima)\b/i, keywords: ['minuman', 'konsumsi'] },
  { pattern: /\b(kertas|pulpen|pensil|buku|map|stapler|tinta|printer|atk)\b/i, keywords: ['atk', 'alat tulis', 'supplies'] },
  { pattern: /\b(kabel|baterai|battery|lampu|colokan|stop\s*kontak)\b/i, keywords: ['perlengkapan', 'listrik'] },
  { pattern: /\b(nasi|ayam|sapi|ikan|burger|pizza|kopi|teh|jus|soda|nasgor|mie\s*goreng)\b/i, keywords: ['makanan', 'konsumsi', 'meals'] },
];

/**
 * Ekstrak keywords spesifik untuk satu line item berdasarkan deskripsinya.
 */
export function extractLineItemKeywords(description: string): string[] {
  const result: string[] = [];
  for (const rule of LINE_ITEM_KEYWORD_RULES) {
    if (rule.pattern.test(description)) {
      for (const k of rule.keywords) {
        if (!result.includes(k)) result.push(k);
      }
    }
  }
  return result;
}

/**
 * Parse line items dari body struk. Strategi:
 * 1. Coba pattern "deskripsi qty unit_price total" dulu (paling spesifik)
 * 2. Fallback ke pattern "deskripsi nominal" (paling umum)
 * 3. Strip skip-keywords (total, ppn, alamat, dll)
 * 4. Eliminasi item dengan deskripsi terlalu pendek/numerik
 */
export function parseLineItems(text: string): OcrLineItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: OcrLineItem[] = [];

  for (const line of lines) {
    if (LINE_ITEM_SKIP_PATTERN.test(line)) continue;
    if (ID_LINE_PATTERN.test(line)) continue;
    if (line.length < 5) continue;

    // Strategy 1: "deskripsi qty unit_price total"
    const qpt = line.match(QTY_PRICE_TOTAL_PATTERN);
    if (qpt) {
      const [, descRaw, qtyRaw, unitRaw, totalRaw] = qpt;
      const description = cleanLineItemDescription(descRaw);
      const quantity = parseInt(qtyRaw, 10);
      const unit_price = normalizeNumber(unitRaw);
      const amount = normalizeNumber(totalRaw);
      if (description && amount && amount > 0 && amount <= MAX_REALISTIC_AMOUNT) {
        items.push({
          description,
          amount,
          quantity: Number.isFinite(quantity) ? quantity : undefined,
          unit_price,
          keywords: extractLineItemKeywords(description),
        });
        continue;
      }
    }

    // Strategy 2: "deskripsi nominal"
    const simple = line.match(LINE_ITEM_PATTERN);
    if (simple) {
      const [, descRaw, amountRaw] = simple;
      let description = cleanLineItemDescription(descRaw);
      const amount = normalizeNumber(amountRaw);

      // Cek qty prefix di description (mis. "2x Indomie Goreng")
      let quantity: number | undefined;
      const qtyMatch = description.match(QTY_PREFIX_PATTERN);
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1], 10);
        description = qtyMatch[2].trim();
      }

      // Validasi: deskripsi harus punya minimal 3 char alfabet, amount realistis,
      // dan tidak boleh terlalu kecil (di bawah 500 = kemungkinan kode/nomor).
      if (
        description &&
        amount &&
        amount >= 500 &&
        amount <= MAX_REALISTIC_AMOUNT &&
        /[a-z]{3,}/i.test(description)
      ) {
        items.push({
          description,
          amount,
          quantity,
          keywords: extractLineItemKeywords(description),
        });
      }
    }
  }

  return items;
}

/**
 * Bersihkan deskripsi line item — strip leading/trailing noise + qty unit suffix.
 */
function cleanLineItemDescription(raw: string): string {
  return raw
    .trim()
    .replace(/^[*•\-_:\s]+/, '')
    .replace(/[*•\-_:\s]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Parse komponen biaya (PPN/service/diskon) dari struk.
 * Untuk tiap baris yang match charge pattern, ekstrak nominalnya.
 */
export function parseCharges(text: string): OcrCharge[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const charges: OcrCharge[] = [];

  for (const line of lines) {
    for (const rule of CHARGE_PATTERNS) {
      if (!rule.pattern.test(line)) continue;
      const amount = extractFormattedNumber(line) ?? extractLargestNumber(line);
      if (!amount || amount <= 0 || amount > MAX_REALISTIC_AMOUNT) continue;

      const isDiscount = rule.type === 'discount';
      charges.push({
        type: rule.type,
        label: line.replace(/\s+/g, ' ').trim(),
        amount: isDiscount ? -Math.abs(amount) : amount,
        keywords: [...rule.keywords],
      });
      break; // satu baris cuma boleh match satu charge type
    }
  }

  return charges;
}

/**
 * Main parser: ambil { date, total, vendor, category, keywords, fallback_keywords,
 * line_items, charges } dari raw OCR text.
 */
export function parseReceipt(rawText: string): OcrParsed {
  const vendor = parseVendor(rawText);
  const line_items = parseLineItems(rawText);
  const charges = parseCharges(rawText);
  return {
    date: parseDate(rawText),
    total: parseTotal(rawText),
    currency_code: parseCurrency(rawText),
    vendor,
    category: inferCategory(vendor, rawText),
    keywords: extractKeywords(vendor, rawText),
    fallback_keywords: extractFallbackKeywords(vendor, rawText),
    line_items: line_items.length > 0 ? line_items : undefined,
    charges: charges.length > 0 ? charges : undefined,
  };
}
