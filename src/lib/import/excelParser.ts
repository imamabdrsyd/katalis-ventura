import * as XLSX from 'xlsx';
import { ParsedRow } from './types';

/**
 * Parse Excel file to JSON array
 */
export async function parseExcelFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Failed to read file'));
          return;
        }

        // Read the workbook
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, {
          raw: false, // Don't use raw values (handle dates properly)
          defval: '', // Default value for empty cells
        });

        // Normalize headers and data
        const normalizedData = jsonData.map((row) => normalizeRow(row));

        resolve(normalizedData);
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Normalize row data - convert column names to standard format
 */
function normalizeRow(row: any): ParsedRow {
  const normalized: any = {};

  // Map of possible column variations to standard names
  const columnMappings: Record<string, string[]> = {
    date: ['date', 'tanggal', 'tgl'],
    category: ['category', 'kategori', 'type', 'tipe'],
    name: ['name', 'nama', 'customer', 'vendor', 'pelanggan'],
    description: ['description', 'deskripsi', 'keterangan', 'notes', 'catatan'],
    amount: ['amount', 'jumlah', 'nominal', 'total'],
    account: ['account', 'akun', 'payment method', 'metode pembayaran'],
    debit_account: ['debit account', 'debit', 'dr', 'akun debit', 'debit_account'],
    credit_account: ['credit account', 'credit', 'cr', 'akun kredit', 'credit_account'],
  };

  // Get all keys from the row (case-insensitive)
  const rowKeys = Object.keys(row);

  // For each standard column, find matching column in the row
  for (const [standardKey, variations] of Object.entries(columnMappings)) {
    const matchingKey = rowKeys.find((key) =>
      variations.some((variation) => key.toLowerCase().trim() === variation.toLowerCase())
    );

    if (matchingKey) {
      normalized[standardKey] = row[matchingKey];
    } else {
      normalized[standardKey] = '';
    }
  }

  return normalized as ParsedRow;
}

/**
 * Convert Excel date serial to ISO date string
 */
export function excelDateToISO(serial: number): string {
  // Excel dates are days since 1900-01-01 (with bug: 1900 is treated as leap year)
  const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
  const date = new Date(excelEpoch.getTime() + serial * 86400000);

  // Format as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Parse date from various formats
 */
export function parseDate(value: any): Date | null {
  if (!value) return null;

  // If it's already a Date object
  if (value instanceof Date) return value;

  // If it's a number (Excel serial date)
  if (typeof value === 'number') {
    const isoDate = excelDateToISO(value);
    return new Date(isoDate);
  }

  // If it's a string
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // Try parsing as ISO date (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(trimmed);
    }

    // Try parsing as DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('/');
      return new Date(`${year}-${month}-${day}`);
    }

    // Try parsing as MM/DD/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return new Date(trimmed);
    }

    // Try general date parsing
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

/**
 * Normalize column headers (case-insensitive, trim whitespace)
 */
export function normalizeHeaders(headers: string[]): string[] {
  return headers.map((header) => header.toLowerCase().trim());
}

/**
 * Validate file before parsing
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
  const ALLOWED_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/octet-stream', // Sometimes Excel files are detected as this
  ];

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds 5MB limit`,
    };
  }

  // Check extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (!hasValidExtension) {
    return {
      valid: false,
      error: 'Invalid file format. Please upload .xlsx, .xls, or .csv file',
    };
  }

  // Check MIME type
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    // Allow if extension is valid (sometimes MIME type is not set correctly)
    if (!hasValidExtension) {
      return {
        valid: false,
        error: 'Invalid file type. Please upload a valid Excel or CSV file',
      };
    }
  }

  // Check for malicious filename patterns
  if (fileName.match(/[<>:"|?*]/)) {
    return {
      valid: false,
      error: 'Invalid filename. Please rename the file and try again',
    };
  }

  return { valid: true };
}
