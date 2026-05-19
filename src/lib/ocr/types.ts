export type OcrProvider = 'google_vision' | 'ocr_space';

export type OcrParsed = {
  date?: string;    // ISO YYYY-MM-DD
  total?: number;   // numeric amount in detected currency
  currency_code?: string; // ISO-4217 currency code detected from the receipt
  vendor?: string;  // merchant name
  category?: 'EARN' | 'OPEX' | 'VAR' | 'CAPEX' | 'TAX' | 'FIN'; // inferred category hint
  // Semantic keywords derived from receipt topic/brand. Used to match the
  // most relevant Chart of Accounts entry (e.g. ["internet","indihome"] → "Internet" account).
  keywords?: string[];
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
  google_vision: 950,   // Google Vision free tier 1000/month, buffer 5%
  ocr_space: 24_000,    // OCR.space free tier 25000/month, buffer 4%
} as const;
