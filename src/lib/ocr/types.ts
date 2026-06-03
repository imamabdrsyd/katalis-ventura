export type OcrProvider = 'gemini' | 'google_vision' | 'ocr_space';

/**
 * Satu baris item belanja yang terdeteksi dari body struk.
 * Setiap line_item bisa dipetakan ke satu journal line dengan akun beban berbeda.
 */
export type OcrLineItem = {
  description: string;       // Nama item, mis. "Beras Premium 5kg"
  amount: number;            // Subtotal item (qty × unit_price)
  quantity?: number;         // Kuantitas, kalau terdeteksi
  unit_price?: number;       // Harga satuan, kalau terdeteksi
  // Keywords spesifik untuk match akun per line (mis. ["beras","bahan pokok"]).
  // Digabung dengan keywords global saat scoring akun.
  keywords?: string[];
};

/**
 * Komponen biaya tambahan di struk (PPN, service charge, diskon).
 * Dipisah ke journal line tersendiri agar akun pajak/diskon tercatat benar.
 */
export type OcrCharge = {
  type: 'tax' | 'service' | 'discount' | 'other';
  label: string;             // Label asli di struk, mis. "PPN 11%", "Service Charge"
  amount: number;            // Nominal (positif untuk tax/service, negatif untuk diskon)
  keywords?: string[];       // Hint untuk match akun (mis. ["pajak","ppn"])
};

export type OcrParsed = {
  date?: string;    // ISO YYYY-MM-DD
  total?: number;   // numeric amount in detected currency
  currency_code?: string; // ISO-4217 currency code detected from the receipt
  vendor?: string;  // merchant name
  category?: 'EARN' | 'OPEX' | 'VAR' | 'CAPEX' | 'TAX' | 'FIN'; // inferred category hint
  // Semantic keywords derived from receipt topic/brand. Used to match the
  // most relevant Chart of Accounts entry (e.g. ["internet","indihome"] → "Internet" account).
  keywords?: string[];
  // Generic fallback keywords from inferred category (mis. OPEX → ["beban","biaya"]).
  // Skor matchnya jauh lebih kecil — cuma berfungsi sebagai tie-breaker, bukan utama.
  fallback_keywords?: string[];
  // Line items belanja yang terdeteksi dari body struk. Kalau >= 2 item,
  // frontend bisa auto-switch ke MultiLineJournalForm.
  line_items?: OcrLineItem[];
  // Komponen biaya tambahan (PPN, service charge, diskon).
  charges?: OcrCharge[];
};

export type OcrResult = {
  provider: OcrProvider;
  raw_text: string;
  parsed: OcrParsed;
  cached: boolean;
};

export class OcrQuotaExceededError extends Error {
  constructor(message = 'Kuota OCR bulan ini sudah habis. Coba lagi bulan depan atau input manual.') {
    super(message);
    this.name = 'OcrQuotaExceededError';
  }
}

export class OcrProviderError extends Error {
  constructor(
    public provider: OcrProvider,
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'OcrProviderError';
  }
}

export const OCR_LIMITS = {
  // Gemini free tier ~1500 req/hari. Pakai cap bulanan konservatif (~1400/hari × 30)
  // sebagai guard; rate limit harian/concurrent ditangani oleh Gemini sendiri.
  gemini: 40_000,
  google_vision: 950,   // Google Vision free tier 1000/month, buffer 5%
  ocr_space: 24_000,    // OCR.space free tier 25000/month, buffer 4%
} as const;
