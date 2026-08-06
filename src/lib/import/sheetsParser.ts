import { normalizeRows } from './excelParser';
import type { ParsedRow } from './types';

/**
 * Parser untuk data mentah dari Google Sheets API.
 *
 * File ini SENGAJA terpisah dari `excelParser.ts` supaya jalur Google Sheets
 * tidak ikut menarik library `xlsx` (~1 MB) ke bundle — Sheets API sudah
 * mengembalikan data terstruktur, tidak perlu parser spreadsheet.
 *
 * Hasil akhirnya (`parsed`) identik bentuknya dengan output `parseExcelFile`,
 * jadi seluruh hilir (validator, smart resolver, preview UI,
 * `createTransactionsBulk`) dipakai ulang tanpa perubahan.
 */

/**
 * Satu sel dari Sheets API dengan `valueRenderOption=UNFORMATTED_VALUE`.
 *
 * PENTING — kenapa UNFORMATTED_VALUE, bukan FORMATTED_VALUE:
 * `sanitizeAmount` di `excelValidator.ts` membuang koma DULU lalu membuang
 * semua titik, sehingga string berformat Indonesia "1.500.000,50" berubah
 * jadi 150000050 (salah 100×). Dengan UNFORMATTED_VALUE, angka datang sebagai
 * `number` asli dan `sanitizeAmount` langsung short-circuit di baris pertama.
 * Tanggal ikut datang sebagai serial number, dan `parseDate` → `excelDateToISO`
 * sudah menanganinya dengan epoch 1899-12-30 yang sama.
 */
export type SheetCell = string | number | boolean | null;

export interface ParsedSheetValues {
  /** Header setelah dedupe + penamaan kolom kosong. Panjangnya = lebar tabel. */
  headers: string[];
  /** Key = header (hasil dedupe). Dipakai sebagai umpan `/api/ai/map-columns`. */
  rows: Record<string, SheetCell>[];
  /** Hasil `normalizeRows` — umpan `detectImportMode` / `validateRows*`. */
  parsed: ParsedRow[];
  /** Jumlah baris yang dilewati karena seluruh selnya kosong. */
  skippedEmptyRows: number;
  /** Jumlah baris data (di luar header) sebelum baris kosong dibuang. */
  totalDataRows: number;
}

export interface ParseSheetValuesOptions {
  /** Index baris header (0-based). Default 0 = baris pertama. */
  headerRowIndex?: number;
}

const EMPTY_RESULT: ParsedSheetValues = {
  headers: [],
  rows: [],
  parsed: [],
  skippedEmptyRows: 0,
  totalDataRows: 0,
};

/** Sel dianggap kosong bila null/undefined atau string yang hanya berisi spasi. */
function isBlankCell(cell: SheetCell): boolean {
  if (cell === null || cell === undefined) return true;
  return typeof cell === 'string' && cell.trim() === '';
}

/**
 * Bikin daftar header yang unik dan tidak ada yang kosong.
 *
 * Kenapa perlu: `Object.keys` menggabungkan key duplikat dan membuang key
 * kosong. Sheet dengan dua kolom "Total" akan kehilangan salah satunya secara
 * diam-diam — itu kehilangan data, bukan sekadar kosmetik. XLSX menangani ini
 * otomatis (`__EMPTY`, `Total_1`); di sini harus eksplisit.
 */
function buildUniqueHeaders(headerRow: SheetCell[]): string[] {
  const seen = new Map<string, number>();

  return headerRow.map((raw, i) => {
    const base = isBlankCell(raw) ? `Kolom ${i + 1}` : String(raw).trim();
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    // Kemunculan pertama pakai nama asli supaya tabel pemetaan EN/ID di
    // `normalizeRow` tetap mengenalinya ("Tanggal", "Jumlah", dst).
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

/**
 * Ubah `values` mentah dari Sheets API jadi bentuk yang siap masuk pipeline import.
 *
 * Menangani empat hal yang di jalur XLSX didapat gratis:
 * 1. Baris ragged — Sheets API memangkas sel kosong di ujung tiap baris.
 * 2. Header duplikat/kosong — lihat `buildUniqueHeaders`.
 * 3. Baris kosong di tengah tabel.
 * 4. Sheet kosong / hanya berisi header.
 */
export function parseSheetValues(
  values: SheetCell[][],
  options: ParseSheetValuesOptions = {}
): ParsedSheetValues {
  const headerRowIndex = options.headerRowIndex ?? 0;

  if (!Array.isArray(values) || values.length <= headerRowIndex) {
    return { ...EMPTY_RESULT };
  }

  const headers = buildUniqueHeaders(values[headerRowIndex] ?? []);
  if (headers.length === 0) {
    return { ...EMPTY_RESULT };
  }

  const dataRows = values.slice(headerRowIndex + 1);
  const rows: Record<string, SheetCell>[] = [];
  let skippedEmptyRows = 0;

  for (const rawRow of dataRows) {
    const row = Array.isArray(rawRow) ? rawRow : [];

    if (row.every(isBlankCell)) {
      skippedEmptyRows++;
      continue;
    }

    // Pad ke lebar header: Sheets API memangkas sel kosong di ujung baris,
    // jadi baris pendek TIDAK berarti kolomnya tidak ada.
    const record: Record<string, SheetCell> = {};
    headers.forEach((header, i) => {
      const cell = i < row.length ? row[i] : '';
      record[header] = cell === null || cell === undefined ? '' : cell;
    });
    rows.push(record);
  }

  return {
    headers,
    rows,
    parsed: normalizeRows(rows),
    skippedEmptyRows,
    totalDataRows: dataRows.length,
  };
}
