import type { BankStatementParsed, BankStatementRow } from '../types';

/**
 * Parser generic fallback untuk bank yang belum punya parser khusus.
 *
 * Heuristic minimal:
 * 1. Cari baris yang start dengan DD/MM/YYYY atau DD-MM-YYYY
 * 2. Ekstrak 1-2 angka di baris itu (amount + optional saldo)
 * 3. Sisa text = description / counterparty
 *
 * Tidak ada validasi summary, tidak ada inference direction yang reliable.
 * User WAJIB review hasil parsing manual sebelum commit.
 */

const FULL_DATE = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/;
const AMOUNT_PATTERN = /[\d,]+\.\d{2}/g;

function parseNumber(s: string): number {
  return parseFloat(s.replace(/,/g, ''));
}

function normalizeDate(d: string, mo: string, y: string): string | undefined {
  const day = d.padStart(2, '0');
  const month = mo.padStart(2, '0');
  const year = y.length === 2 ? `20${y}` : y;
  if (parseInt(month, 10) > 12 || parseInt(day, 10) > 31) return undefined;
  return `${year}-${month}-${day}`;
}

export function parseGenericStatement(rawText: string): BankStatementParsed {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows: BankStatementRow[] = [];

  for (const line of lines) {
    const dm = line.match(FULL_DATE);
    if (!dm) continue;
    const posted_at = normalizeDate(dm[1], dm[2], dm[3]);
    if (!posted_at) continue;

    const amounts = Array.from(line.matchAll(AMOUNT_PATTERN)).map(m => parseNumber(m[0]));
    if (amounts.length === 0) continue;

    const hasDb = /\bDB\b/i.test(line) || /\bDEBIT\b/i.test(line);
    const amount = amounts[0];

    const description = line
      .replace(FULL_DATE, '')
      .replace(AMOUNT_PATTERN, '')
      .replace(/\b(DB|CR|DEBIT|CREDIT|KREDIT)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    rows.push({
      posted_at,
      description: description || 'Mutasi bank',
      amount: hasDb ? -amount : amount,
      running_balance: amounts.length >= 2 ? amounts[amounts.length - 1] : undefined,
    });
  }

  return {
    bank_code: 'GENERIC',
    rows,
    period_start: rows[0]?.posted_at,
    period_end: rows[rows.length - 1]?.posted_at,
    validation: {
      is_balanced: false,
      warnings: ['Parser generic: tidak ada validasi summary. Review manual sebelum commit.'],
    },
  };
}
