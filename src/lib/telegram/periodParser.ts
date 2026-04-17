// Parser periode natural language Indonesia
// Return: { startDate, endDate, label } atau null

const MONTH_NAMES: Record<string, number> = {
  'januari': 0, 'jan': 0,
  'februari': 1, 'feb': 1, 'pebruari': 1,
  'maret': 2, 'mar': 2,
  'april': 3, 'apr': 3,
  'mei': 4,
  'juni': 5, 'jun': 5,
  'juli': 6, 'jul': 6,
  'agustus': 7, 'agt': 7, 'ags': 7, 'aug': 7,
  'september': 8, 'sep': 8, 'sept': 8,
  'oktober': 9, 'okt': 9, 'oct': 9,
  'november': 10, 'nov': 10,
  'desember': 11, 'des': 11, 'dec': 11,
};

const MONTH_LABEL: Record<number, string> = {
  0: 'Januari', 1: 'Februari', 2: 'Maret', 3: 'April', 4: 'Mei', 5: 'Juni',
  6: 'Juli', 7: 'Agustus', 8: 'September', 9: 'Oktober', 10: 'November', 11: 'Desember',
};

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface ParsedPeriod {
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  label: string;       // User-facing label
}

export function parsePeriodFromText(text: string): ParsedPeriod | null {
  const lower = text.toLowerCase().trim();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Bulan ini
  if (/\b(bulan ini|this month)\b/.test(lower)) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { startDate: formatDate(start), endDate: formatDate(end), label: `${MONTH_LABEL[month]} ${year}` };
  }

  // Bulan lalu / bulan kemarin
  if (/\b(bulan lalu|bulan kemarin|bulan kemaren|last month)\b/.test(lower)) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return { startDate: formatDate(start), endDate: formatDate(end), label: `${MONTH_LABEL[start.getMonth()]} ${start.getFullYear()}` };
  }

  // Tahun ini
  if (/\b(tahun ini|this year)\b/.test(lower)) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    return { startDate: formatDate(start), endDate: formatDate(end), label: `Tahun ${year}` };
  }

  // Tahun lalu
  if (/\b(tahun lalu|tahun kemarin|tahun kemaren|last year)\b/.test(lower)) {
    const start = new Date(year - 1, 0, 1);
    const end = new Date(year - 1, 11, 31);
    return { startDate: formatDate(start), endDate: formatDate(end), label: `Tahun ${year - 1}` };
  }

  // Quarter: Q1/Q2/Q3/Q4 [tahun]
  const qMatch = lower.match(/\bq([1-4])(?:\s+(\d{4}))?\b/);
  if (qMatch) {
    const q = parseInt(qMatch[1]);
    const qYear = qMatch[2] ? parseInt(qMatch[2]) : year;
    const startMonth = (q - 1) * 3;
    const start = new Date(qYear, startMonth, 1);
    const end = new Date(qYear, startMonth + 3, 0);
    return { startDate: formatDate(start), endDate: formatDate(end), label: `Q${q} ${qYear}` };
  }

  // Nama bulan [tahun] — "januari", "januari 2026", "jan 2026"
  const monthMatch = lower.match(/\b([a-z]+)(?:\s+(\d{4}))?\b/);
  if (monthMatch && monthMatch[1] in MONTH_NAMES) {
    const m = MONTH_NAMES[monthMatch[1]];
    const mYear = monthMatch[2] ? parseInt(monthMatch[2]) : year;
    const start = new Date(mYear, m, 1);
    const end = new Date(mYear, m + 1, 0);
    return { startDate: formatDate(start), endDate: formatDate(end), label: `${MONTH_LABEL[m]} ${mYear}` };
  }

  return null;
}

// Deteksi jenis laporan dari teks
export type ReportType = 'income_statement' | 'balance_sheet' | 'cash_flow';

export function detectReportType(text: string): ReportType | null {
  const lower = text.toLowerCase().trim();

  if (/\b(income statement|laba rugi|laba\/rugi|profit loss|p&l|pnl|laba)\b/.test(lower)) {
    return 'income_statement';
  }
  if (/\b(balance sheet|neraca)\b/.test(lower)) {
    return 'balance_sheet';
  }
  if (/\b(cash flow|cashflow|arus kas|aliran kas)\b/.test(lower)) {
    return 'cash_flow';
  }
  return null;
}
