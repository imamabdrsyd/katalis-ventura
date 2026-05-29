import { createHash } from 'crypto';
import { hashFile, runOcr } from '@/lib/ocr';
import { parseBcaStatement } from './parsers/bca';
import { parseGenericStatement } from './parsers/generic';
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
 * Orchestrator utama untuk import file mutasi bank.
 * Routing:
 *   - PDF (application/pdf): runOcr dengan 'ocr_space_only' (Vision tidak support PDF sync)
 *   - Image (jpg/png): runOcr dengan 'auto' (Vision dulu, fallback OCR.space)
 *
 * Lalu pakai parseBankStatement untuk extract rows.
 */
export async function scanBankStatement(
  fileBuffer: Buffer,
  options: {
    bankCode: BankCode;
    mimeType: string;
    fileHash?: string;
  }
): Promise<BankStatementScanResult> {
  const hash = options.fileHash ?? hashFile(fileBuffer);
  const isPdf = options.mimeType.toLowerCase().includes('pdf');
  const source: StatementSource = isPdf ? 'pdf_ocr' : 'image_ocr';

  const ocr = await runOcr(fileBuffer, {
    fileHash: hash,
    mimeType: options.mimeType,
    preference: isPdf ? 'ocr_space_only' : 'auto',
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
