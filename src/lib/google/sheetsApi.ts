import type { SheetCell } from '@/lib/import/sheetsParser';

/**
 * Wrapper tipis Google Sheets API v4 memakai raw `fetch`.
 *
 * Sengaja tidak memakai library `googleapis` (~15 MB) — seluruh panggilan
 * Google di repo ini pakai raw fetch (lihat src/lib/ai/vertexAuth.ts), dan
 * kita cuma butuh empat endpoint.
 *
 * Semua fungsi menerima access token yang SUDAH divalidasi lewat
 * `getValidGoogleAccessToken()`. Modul ini tidak menyentuh DB.
 *
 * Catatan scope: semua operasi di sini sah di bawah `drive.file` selama
 * spreadsheet-nya dibuat oleh app ini atau dipilih user lewat Google Picker.
 */

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Validator ID spreadsheet.
 *
 * WAJIB dipakai sebelum ID diinterpolasi ke URL. Tanpa ini, ID yang memuat
 * `../` bisa melakukan path traversal di dalam host sheets.googleapis.com.
 */
export const SPREADSHEET_ID_RE = /^[a-zA-Z0-9-_]{20,100}$/;

export function isValidSpreadsheetId(id: string): boolean {
  return typeof id === 'string' && SPREADSHEET_ID_RE.test(id);
}

/**
 * Kutip nama sheet untuk notasi A1.
 * `My Sheet` → `'My Sheet'` · `Bob's` → `'Bob''s'`
 * Tanpa ini, nama bertanda kutip atau berspasi bikin range tidak valid.
 */
export function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

/** Error terstruktur supaya route bisa memetakan ke HTTP status yang tepat. */
export class SheetsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: 'forbidden' | 'not_found' | 'unauthorized' | 'unknown'
  ) {
    super(message);
    this.name = 'SheetsApiError';
  }
}

async function sheetsFetch(url: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (res.ok) return res;

  const detail = await res.text().catch(() => '');

  if (res.status === 403) {
    // Kasus support paling sering: user menempelkan URL/ID spreadsheet yang
    // tidak pernah dipilih lewat Picker, jadi tidak ada grant drive.file.
    throw new SheetsApiError(
      'File ini belum diberi izin ke AXION. Pilih ulang lewat tombol Pilih Spreadsheet.',
      403,
      'forbidden'
    );
  }
  if (res.status === 404) {
    throw new SheetsApiError('Spreadsheet tidak ditemukan.', 404, 'not_found');
  }
  if (res.status === 401) {
    throw new SheetsApiError('Sesi Google kedaluwarsa. Hubungkan ulang akun Google.', 401, 'unauthorized');
  }

  throw new SheetsApiError(
    `Google Sheets API error ${res.status}: ${detail.slice(0, 200)}`,
    res.status,
    'unknown'
  );
}

export interface SheetTab {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMeta {
  title: string;
  sheets: SheetTab[];
}

export async function getSpreadsheetMeta(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMeta> {
  if (!isValidSpreadsheetId(spreadsheetId)) {
    throw new SheetsApiError('ID spreadsheet tidak valid.', 400, 'unknown');
  }

  const fields = encodeURIComponent('properties.title,sheets.properties(sheetId,title,gridProperties)');
  const res = await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}?fields=${fields}`, accessToken);
  const json = await res.json();

  return {
    title: json.properties?.title ?? 'Untitled',
    sheets: (json.sheets ?? []).map((s: Record<string, never>) => {
      const p = (s as { properties?: Record<string, unknown> }).properties ?? {};
      const grid = (p.gridProperties ?? {}) as { rowCount?: number; columnCount?: number };
      return {
        sheetId: (p.sheetId as number) ?? 0,
        title: (p.title as string) ?? '',
        rowCount: grid.rowCount ?? 0,
        columnCount: grid.columnCount ?? 0,
      };
    }),
  };
}

/**
 * Baca nilai satu range.
 *
 * `valueRenderOption=UNFORMATTED_VALUE` itu WAJIB, bukan preferensi:
 * `sanitizeAmount` di excelValidator membuang koma lalu membuang semua titik,
 * sehingga string berformat Indonesia "1.500.000,50" berubah jadi 150000050
 * (salah 100×). UNFORMATTED_VALUE mengembalikan `number` asli sehingga
 * sanitizeAmount short-circuit. Tanggal jadi serial number, dan `parseDate`
 * sudah menanganinya dengan epoch 1899-12-30 yang sama seperti XLSX.
 */
export async function getSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<SheetCell[][]> {
  if (!isValidSpreadsheetId(spreadsheetId)) {
    throw new SheetsApiError('ID spreadsheet tidak valid.', 400, 'unknown');
  }

  const url =
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}` +
    `?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS`;

  const res = await sheetsFetch(url, accessToken);
  const json = await res.json();
  return (json.values ?? []) as SheetCell[][];
}

export interface CreatedSpreadsheet {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

/**
 * Buat spreadsheet baru di Drive user.
 *
 * Diizinkan `drive.file` tanpa syarat apa pun karena app inilah yang membuat
 * filenya — tidak perlu Picker. Inilah sebabnya jalur export bisa dirilis
 * lebih dulu daripada jalur import.
 */
export async function createSpreadsheet(
  accessToken: string,
  title: string,
  firstSheetTitle: string
): Promise<CreatedSpreadsheet> {
  const res = await sheetsFetch(SHEETS_BASE, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: firstSheetTitle } }],
    }),
  });

  const json = await res.json();
  return {
    spreadsheetId: json.spreadsheetId,
    spreadsheetUrl:
      json.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${json.spreadsheetId}/edit`,
  };
}

/**
 * Tulis nilai ke range.
 *
 * `valueInputOption=RAW`, BUKAN `USER_ENTERED`: label laporan yang diawali `=`
 * (atau `+`, `-`, `@`) akan dieksekusi sebagai formula bila memakai
 * USER_ENTERED — jalur klasik formula injection.
 */
export async function writeSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number)[][]
): Promise<void> {
  if (!isValidSpreadsheetId(spreadsheetId)) {
    throw new SheetsApiError('ID spreadsheet tidak valid.', 400, 'unknown');
  }

  const url =
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}` +
    `?valueInputOption=RAW`;

  await sheetsFetch(url, accessToken, {
    method: 'PUT',
    body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
  });
}

/**
 * Rapikan tampilan sheet hasil export: header tebal + lebar kolom proporsional.
 * Best-effort — kegagalan di sini tidak boleh menggagalkan export yang datanya
 * sudah tertulis.
 */
export async function formatReportSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetId: number,
  columnCount: number
): Promise<void> {
  if (!isValidSpreadsheetId(spreadsheetId)) return;

  const requests: unknown[] = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 280 },
        fields: 'pixelSize',
      },
    },
  ];

  if (columnCount > 1) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: columnCount },
        properties: { pixelSize: 160 },
        fields: 'pixelSize',
      },
    });
  }

  try {
    await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });
  } catch {
    // Sengaja diabaikan — data sudah tertulis, format cuma kosmetik.
  }
}
