/**
 * Tipe-tipe untuk parsing mutasi bank.
 * Dipakai oleh parsers per-bank dan orchestrator scanBankStatement().
 */

export type BankCode = 'BCA' | 'MANDIRI' | 'BRI' | 'BNI' | 'GENERIC';

export type StatementSource = 'csv' | 'xlsx' | 'pdf_ocr' | 'image_ocr' | 'manual';

/**
 * Satu baris mutasi yang sudah di-parse.
 * amount: positif = uang masuk (CR), negatif = uang keluar (DB).
 */
export type BankStatementRow = {
  posted_at: string;          // ISO YYYY-MM-DD (posting date)
  value_date?: string;        // ISO YYYY-MM-DD (kalau beda dari posting)
  description: string;        // mis. "TRSF E-BANKING DB"
  amount: number;             // (+) masuk, (-) keluar
  running_balance?: number;   // saldo setelah transaksi (kalau ada di statement)
  reference_code?: string;    // FTSCY code / BIF code / LLG bank
  counterparty_name?: string; // nama lawan transaksi
};

/**
 * Hasil parser bank statement.
 * Summary di-derive dari header & footer file untuk validasi rekonsiliasi.
 */
export type BankStatementParsed = {
  bank_code: BankCode;
  account_number?: string;
  period_start?: string;      // ISO YYYY-MM-DD
  period_end?: string;        // ISO YYYY-MM-DD
  opening_balance?: number;
  closing_balance?: number;
  total_credit?: number;
  total_debit?: number;
  rows: BankStatementRow[];

  // Validasi: cek apakah opening + total_credit - total_debit ≈ closing
  // Diisi oleh validateBankStatement() setelah parse
  validation?: {
    is_balanced: boolean;
    expected_closing?: number;
    diff?: number;
    warnings: string[];
  };
};

export type BankStatementScanResult = {
  source: StatementSource;
  raw_text: string;
  parsed: BankStatementParsed;
  cached: boolean;
};

export class BankStatementParseError extends Error {
  constructor(message: string, public bank_code?: BankCode) {
    super(message);
    this.name = 'BankStatementParseError';
  }
}
