import * as XLSX from 'xlsx';
import type { BankStatementParsed, BankStatementRow } from '../types';

/**
 * Parser untuk file mutasi bank dalam format CSV/XLSX.
 *
 * Berjalan di server (Node.js). Pakai `xlsx` library yang sudah ada di project
 * (dipakai juga oleh import transaksi).
 *
 * Format kolom didukung (case-insensitive, banyak variasi):
 *   - Tanggal / Date / Posting Date
 *   - Keterangan / Description / Remarks
 *   - Mutasi / Amount  (single kolom, perlu DB/CR indicator)
 *   - Debit / Kredit   (dua kolom terpisah)
 *   - Saldo / Balance  (opsional)
 *   - Referensi / Reference Code (opsional)
 *
 * Kalau ada kolom Debit + Kredit terpisah → debit negatif, kredit positif.
 * Kalau cuma kolom Mutasi/Amount → cek kolom "Type" (DB/CR) atau suffix di
 * amount value (e.g. "1,000.00 DB").
 */

type RawCell = string | number | boolean | null | undefined;
type RawRow = Record<string, RawCell>;

const COLUMN_MAPPINGS: Record<string, string[]> = {
  date: ['date', 'tanggal', 'tgl', 'posting date', 'tgl transaksi', 'tanggal transaksi'],
  description: ['description', 'deskripsi', 'keterangan', 'remarks', 'narasi', 'transaction details'],
  amount: ['amount', 'mutasi', 'nominal', 'jumlah'],
  debit: ['debit', 'db', 'pengeluaran', 'keluar', 'out', 'withdrawal'],
  credit: ['credit', 'kredit', 'cr', 'pemasukan', 'masuk', 'in', 'deposit'],
  balance: ['balance', 'saldo', 'running balance'],
  reference: ['reference', 'referensi', 'ref', 'reference code', 'no referensi'],
  counterparty: ['counterparty', 'lawan transaksi', 'penerima', 'pengirim', 'beneficiary'],
  type: ['type', 'tipe', 'db/cr', 'd/c', 'mutasi type'],
};

function parseNumberCell(v: RawCell): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[^\d.,\-]/g, '');
  // Detect format: "1.234.567,89" (Indonesian) vs "1,234,567.89" (English)
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized = s;
  if (lastComma > lastDot) {
    // Indonesian format: "." = thousand, "," = decimal
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    // English format: "," = thousand, "." = decimal
    normalized = s.replace(/,/g, '');
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

function normalizeDate(v: RawCell): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;

  // Excel serial number
  if (typeof v === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + v * 86400000);
    return formatISODate(date);
  }

  const s = String(v).trim();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, yRaw] = dmy;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Fallback: native Date parsing
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return formatISODate(parsed);

  return undefined;
}

function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Map header columns → standard keys. Return map: standardKey → original column name.
 */
function detectColumns(sampleRow: RawRow): Record<string, string> {
  const result: Record<string, string> = {};
  const keys = Object.keys(sampleRow);
  for (const [standard, variations] of Object.entries(COLUMN_MAPPINGS)) {
    const matched = keys.find(k =>
      variations.some(v => k.toLowerCase().trim() === v.toLowerCase())
    );
    if (matched) result[standard] = matched;
  }
  return result;
}

function getCell(row: RawRow, col: string | undefined): RawCell {
  if (!col) return undefined;
  return row[col];
}

function getStr(row: RawRow, col: string | undefined): string {
  const v = getCell(row, col);
  return v === undefined || v === null ? '' : String(v).trim();
}

/**
 * Parse satu row CSV/XLSX → BankStatementRow.
 * Return null kalau row tidak punya tanggal valid (header noise, summary row, dll).
 */
function parseRow(row: RawRow, cols: Record<string, string>): BankStatementRow | null {
  const posted_at = normalizeDate(getCell(row, cols.date));
  if (!posted_at) return null;

  let amount = 0;

  if (cols.debit || cols.credit) {
    // Format dua kolom: Debit (out) + Credit (in)
    const debit = parseNumberCell(getCell(row, cols.debit));
    const credit = parseNumberCell(getCell(row, cols.credit));
    amount = credit - debit;
  } else if (cols.amount) {
    // Format satu kolom: Mutasi/Amount + optional Type column
    let raw = parseNumberCell(getCell(row, cols.amount));
    const typeStr = getStr(row, cols.type).toUpperCase();
    const amountStr = getStr(row, cols.amount).toUpperCase();
    const isDebit = /\bDB?\b|\bDEBIT\b/.test(typeStr) || /\bDB\b/.test(amountStr);
    if (isDebit) raw = -Math.abs(raw);
    amount = raw;
  }

  // Skip kalau amount 0 (mungkin baris header/empty)
  if (amount === 0) return null;

  const description = getStr(row, cols.description) || 'Mutasi bank';
  const balance = cols.balance ? parseNumberCell(getCell(row, cols.balance)) : undefined;
  const reference = cols.reference ? getStr(row, cols.reference) || undefined : undefined;
  const counterparty = cols.counterparty ? getStr(row, cols.counterparty) || undefined : undefined;

  return {
    posted_at,
    description,
    amount,
    running_balance: balance && balance !== 0 ? balance : undefined,
    reference_code: reference,
    counterparty_name: counterparty,
  };
}

/**
 * Parser utama untuk file CSV/XLSX mutasi bank.
 * Input: file buffer (server-side).
 */
export function parseCsvExcelStatement(fileBuffer: Buffer): BankStatementParsed {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { bank_code: 'GENERIC', rows: [], validation: { is_balanced: false, warnings: ['File kosong'] } };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const json = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '', raw: false });

  if (json.length === 0) {
    return { bank_code: 'GENERIC', rows: [], validation: { is_balanced: false, warnings: ['Tidak ada baris di sheet pertama'] } };
  }

  const cols = detectColumns(json[0]);

  // Required minimum: date + (debit/credit) atau (amount)
  if (!cols.date || (!cols.debit && !cols.credit && !cols.amount)) {
    return {
      bank_code: 'GENERIC',
      rows: [],
      validation: {
        is_balanced: false,
        warnings: [
          `Kolom yang dibutuhkan tidak terdeteksi. Detected: ${Object.keys(cols).join(', ') || '(none)'}. Butuh kolom tanggal + (debit/kredit atau jumlah).`,
        ],
      },
    };
  }

  const rows: BankStatementRow[] = [];
  for (const r of json) {
    const parsed = parseRow(r, cols);
    if (parsed) rows.push(parsed);
  }

  return {
    bank_code: 'GENERIC',
    rows,
    period_start: rows[0]?.posted_at,
    period_end: rows[rows.length - 1]?.posted_at,
    opening_balance: rows.length > 0 && rows[0].running_balance !== undefined
      ? rows[0].running_balance - rows[0].amount
      : undefined,
    closing_balance: rows.length > 0 ? rows[rows.length - 1].running_balance : undefined,
    validation: {
      is_balanced: true,
      warnings: rows.length === 0
        ? ['Tidak ada baris transaksi terdeteksi']
        : [],
    },
  };
}
