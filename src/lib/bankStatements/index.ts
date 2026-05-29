import { createHash } from 'crypto';
import { hashFile, runOcr } from '@/lib/ocr';
import { parseBcaStatement } from './parsers/bca';
import { parseGenericStatement } from './parsers/generic';
import { parseCsvExcelStatement } from './parsers/csvExcel';
import type {
  BankCode,
  BankStatementParsed,
  BankStatementRow,
  BankStatementScanResult,
  StatementSource,
} from './types';
import { BankStatementParseError } from './types';

export { BankStatementParseError } from './types';
export type {
  BankCode,
  BankStatementParsed,
  BankStatementRow,
  BankStatementScanResult,
  StatementSource,
} from './types';

/**
 * Pilih parser berdasarkan bank code.
 */
export function parseBankStatement(rawText: string, bankCode: BankCode): BankStatementParsed {
  switch (bankCode) {
    case 'BCA':
      return parseBcaStatement(rawText);
    case 'MANDIRI':
    case 'BRI':
    case 'BNI':
      // Belum ada parser khusus — fallback ke generic. Akan dibuat fase berikutnya.
      return { ...parseGenericStatement(rawText), bank_code: bankCode };
    case 'GENERIC':
    default:
      return parseGenericStatement(rawText);
  }
}

/**
 * Detect kategori file dari MIME type + nama file.
 */
function detectFileKind(mimeType: string, fileName?: string): 'pdf' | 'image' | 'csv' | 'xlsx' {
  const mt = mimeType.toLowerCase();
  const fn = (fileName ?? '').toLowerCase();
  if (mt.includes('pdf') || fn.endsWith('.pdf')) return 'pdf';
  if (mt.includes('csv') || fn.endsWith('.csv')) return 'csv';
  if (
    mt.includes('spreadsheetml') ||
    mt.includes('ms-excel') ||
    fn.endsWith('.xlsx') ||
    fn.endsWith('.xls')
  ) {
    return 'xlsx';
  }
  return 'image';
}

/**
 * Orchestrator utama untuk import file mutasi bank.
 * Routing per kategori file:
 *   - PDF: runOcr 'ocr_space_only' → parser per-bank
 *   - Image: runOcr 'auto' → parser per-bank
 *   - CSV / XLSX: parseCsvExcelStatement (server-side, tanpa OCR)
 */
export async function scanBankStatement(
  fileBuffer: Buffer,
  options: {
    bankCode: BankCode;
    mimeType: string;
    fileName?: string;
    fileHash?: string;
  }
): Promise<BankStatementScanResult> {
  const hash = options.fileHash ?? hashFile(fileBuffer);
  const kind = detectFileKind(options.mimeType, options.fileName);

  // CSV/XLSX → langsung parse tanpa OCR
  if (kind === 'csv' || kind === 'xlsx') {
    const source: StatementSource = kind === 'csv' ? 'csv' : 'xlsx';
    const parsed = parseCsvExcelStatement(fileBuffer);

    // Set bank_code dari user pilihan (bukan dari parser yang default ke GENERIC)
    parsed.bank_code = options.bankCode;

    if (parsed.rows.length === 0) {
      throw new BankStatementParseError(
        `Tidak ada baris transaksi terdeteksi dari file ${kind.toUpperCase()}. ${
          parsed.validation?.warnings.join(' ') ?? ''
        }`,
        options.bankCode
      );
    }

    return {
      source,
      raw_text: '', // CSV/XLSX tidak punya raw_text — bisa di-derive ulang dari raw_row JSON
      parsed,
      cached: false,
    };
  }

  // PDF / Image → OCR pipeline
  const source: StatementSource = kind === 'pdf' ? 'pdf_ocr' : 'image_ocr';
  const ocr = await runOcr(fileBuffer, {
    fileHash: hash,
    mimeType: options.mimeType,
    preference: kind === 'pdf' ? 'ocr_space_only' : 'auto',
  });

  const parsed = parseBankStatement(ocr.raw_text, options.bankCode);

  if (parsed.rows.length === 0) {
    throw new BankStatementParseError(
      `Tidak ada baris transaksi terdeteksi dari file ${options.bankCode}. Periksa apakah format file benar.`,
      options.bankCode
    );
  }

  return {
    source,
    raw_text: ocr.raw_text,
    parsed,
    cached: ocr.cached,
  };
}

/**
 * Hash unik per baris mutasi untuk dedup (cegah duplicate import).
 * Sengaja TIDAK include running_balance — kalau bank koreksi saldo,
 * baris yang sama tidak boleh di-treat sebagai transaksi baru.
 */
export function computeDedupHash(row: BankStatementRow): string {
  const key = [
    row.posted_at,
    row.amount.toFixed(2),
    (row.description ?? '').toUpperCase().trim(),
    (row.counterparty_name ?? '').toUpperCase().trim(),
    row.reference_code ?? '',
  ].join('|');
  return createHash('sha256').update(key).digest('hex');
}
