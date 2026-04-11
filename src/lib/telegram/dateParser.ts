// Parser tanggal natural language Indonesia
// Return: string 'YYYY-MM-DD' atau null jika tidak bisa diparse

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

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface ParsedDate {
  date: string;       // YYYY-MM-DD
  label: string;      // User-facing label
}

export function parseDateFromText(text: string): ParsedDate | null {
  const lower = text.toLowerCase().trim();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Relative: hari ini, sekarang
  if (/\b(hari ini|skrg|sekarang|today)\b/.test(lower)) {
    return { date: formatDate(now), label: 'hari ini' };
  }

  // Relative: kemarin/kemaren/kmaren/kmrn/kmrin
  if (/\b(kemarin|kemaren|kmarin|kmaren|kmrn|kmrin|yesterday)\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { date: formatDate(d), label: 'kemarin' };
  }

  // Relative: kemarin lusa / 2 hari lalu
  if (/\b(kemarin lusa|2 hari lalu|2 hari yang lalu)\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    return { date: formatDate(d), label: '2 hari lalu' };
  }

  // Relative: X hari lalu / X hari yang lalu
  const daysAgoMatch = lower.match(/(\d+)\s*hari\s*(yang)?\s*lalu/);
  if (daysAgoMatch) {
    const n = parseInt(daysAgoMatch[1]);
    if (n > 0 && n < 365) {
      const d = new Date(now);
      d.setDate(d.getDate() - n);
      return { date: formatDate(d), label: `${n} hari lalu` };
    }
  }

  // Format: DD/MM/YYYY atau DD-MM-YYYY atau DD/MM atau DD-MM
  const slashMatch = lower.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (slashMatch) {
    const dd = parseInt(slashMatch[1]);
    const mm = parseInt(slashMatch[2]);
    let yyyy = slashMatch[3] ? parseInt(slashMatch[3]) : now.getFullYear();
    if (yyyy < 100) yyyy += 2000;
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      const d = new Date(yyyy, mm - 1, dd);
      if (!isNaN(d.getTime())) {
        return { date: formatDate(d), label: `${dd}/${mm}/${yyyy}` };
      }
    }
  }

  // Format: "10 april", "10 april 2026", "10 apr 2026"
  const textDateMatch = lower.match(/\b(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?\b/);
  if (textDateMatch) {
    const dd = parseInt(textDateMatch[1]);
    const monthName = textDateMatch[2];
    const yyyy = textDateMatch[3] ? parseInt(textDateMatch[3]) : now.getFullYear();
    if (monthName in MONTH_NAMES && dd >= 1 && dd <= 31) {
      const d = new Date(yyyy, MONTH_NAMES[monthName], dd);
      if (!isNaN(d.getTime())) {
        const monthLabel = Object.keys(MONTH_NAMES).find((k) => MONTH_NAMES[k] === MONTH_NAMES[monthName] && k.length > 3) ?? monthName;
        return { date: formatDate(d), label: `${dd} ${monthLabel} ${yyyy}` };
      }
    }
  }

  return null;
}

// Deteksi apakah text adalah permintaan lihat transaksi
export function isListTransactionIntent(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return /^(lihat|tampilkan|list|show|tampil|cek|liat)\s+(transaksi|tx|trx)/.test(lower);
}
