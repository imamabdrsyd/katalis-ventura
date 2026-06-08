/**
 * Parser deterministik untuk CSV Airbnb.
 *
 * Format CSV Airbnb punya 2 tipe baris:
 * - "Payout"      → settlement keuangan (kolom: Date, Paid out)
 * - "Reservation" → detail booking (kolom: Date, Guest, Amount, Gross earnings,
 *                   Service fee, Nights, Start date, End date)
 *
 * Mapping ke double-entry journal (3 baris per booking):
 *   Dr Bank (1200)              = Paid out (net)
 *   Dr Komisi Platform (5900)   = Service fee
 *     Cr Short-term Rent (4200) = Gross earnings
 *
 * Check: Paid out + Service fee = Gross earnings
 */

export interface AirbnbRow {
  date: string;
  type: string;
  bookingDate?: string;
  startDate?: string;
  endDate?: string;
  nights?: number;
  guest?: string;
  amount?: number;
  paidOut?: number;
  serviceFee?: number;
  grossEarnings?: number;
}

export interface AirbnbBooking {
  /** Tanggal payout (tanggal yang dipakai di jurnal) */
  date: string;
  /** Tanggal mulai menginap */
  startDate: string;
  /** Tanggal akhir menginap */
  endDate: string;
  nights: number;
  guest: string;
  /** Net yang diterima = grossEarnings - serviceFee */
  paidOut: number;
  serviceFee: number;
  grossEarnings: number;
}

export interface AirbnbParseResult {
  bookings: AirbnbBooking[];
  skipped: number;
  errors: string[];
}

function parseAmount(val: string | undefined): number {
  if (!val) return 0;
  // Airbnb: "$487.22" atau "487.22" atau "(16.78)" untuk negative
  const cleaned = val.replace(/[$,\s]/g, '').replace(/\(([^)]+)\)/, '-$1');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.abs(n);
}

function parseAirbnbDate(val: string | undefined): string {
  if (!val) return new Date().toISOString().split('T')[0];
  // Airbnb format: "MM/DD/YYYY" atau "DD/MM/YYYY" atau "YYYY-MM-DD"
  const trimmed = val.trim();

  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // MM/DD/YYYY
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return trimmed;
}

export function parseAirbnbCSV(csvText: string): AirbnbParseResult {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    return { bookings: [], skipped: 0, errors: ['File CSV kosong atau tidak valid'] };
  }

  // Deteksi header (baris pertama)
  const rawHeader = lines[0];
  const headers = rawHeader.split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

  const idx = {
    date: headers.indexOf('date'),
    type: headers.indexOf('type'),
    bookingDate: headers.indexOf('booking date'),
    startDate: headers.indexOf('start date'),
    endDate: headers.indexOf('end date'),
    nights: headers.indexOf('nights'),
    guest: headers.indexOf('guest'),
    amount: headers.indexOf('amount'),
    paidOut: headers.indexOf('paid out'),
    serviceFee: headers.indexOf('service fee'),
    grossEarnings: headers.indexOf('gross earnings'),
  };

  // Minimal: date + type harus ada
  if (idx.date === -1 || idx.type === -1) {
    return { bookings: [], skipped: 0, errors: ['Format CSV tidak dikenali: kolom Date dan Type tidak ditemukan'] };
  }

  const rows: AirbnbRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV split (handle quoted fields)
    const cols = parseCsvLine(line);
    const get = (colIdx: number) => (colIdx >= 0 ? (cols[colIdx] ?? '').replace(/"/g, '').trim() : undefined);

    const type = get(idx.type) ?? '';
    if (!type) continue;

    rows.push({
      date: parseAirbnbDate(get(idx.date)),
      type,
      bookingDate: parseAirbnbDate(get(idx.bookingDate)),
      startDate: parseAirbnbDate(get(idx.startDate)),
      endDate: parseAirbnbDate(get(idx.endDate)),
      nights: parseInt(get(idx.nights) ?? '0') || 0,
      guest: get(idx.guest),
      amount: parseAmount(get(idx.amount)),
      paidOut: parseAmount(get(idx.paidOut)),
      serviceFee: parseAmount(get(idx.serviceFee)),
      grossEarnings: parseAmount(get(idx.grossEarnings)),
    });
  }

  // Pisahkan Payout dan Reservation
  const payouts = rows.filter(r => r.type.toLowerCase().includes('payout'));
  const reservations = rows.filter(r => r.type.toLowerCase().includes('reservation'));

  // Pasangkan: reservasi → cari payout terdekat setelah end date
  // Strategi: per index urutan (Airbnb biasanya Payout lalu Reservation di bawahnya, atau sebaliknya)
  // Kita match by posisi: tiap payout di-pair dengan reservation setelah/sebelumnya
  const bookings: AirbnbBooking[] = [];
  let skipped = 0;

  // Coba pair langsung: biasanya struktur Airbnb adalah Payout + Reservation berpasangan
  // Atau jika tidak berpasangan, pakai Reservation saja (paidOut = grossEarnings - serviceFee)
  if (reservations.length > 0) {
    for (const res of reservations) {
      // Cari payout yang paidOut ≈ grossEarnings - serviceFee
      const expectedPaidOut = (res.grossEarnings ?? 0) - (res.serviceFee ?? 0);
      const matchedPayout = payouts.find(
        p => p.paidOut !== undefined && Math.abs(p.paidOut - expectedPaidOut) < 1
      );

      const grossEarnings = res.grossEarnings ?? res.amount ?? 0;
      const serviceFee = res.serviceFee ?? 0;
      const paidOut = matchedPayout?.paidOut ?? (grossEarnings - serviceFee);

      if (grossEarnings <= 0) {
        skipped++;
        continue;
      }

      bookings.push({
        date: matchedPayout?.date ?? res.date,
        startDate: res.startDate ?? res.date,
        endDate: res.endDate ?? res.date,
        nights: res.nights ?? 0,
        guest: res.guest ?? 'Airbnb Guest',
        paidOut: Math.round(paidOut),
        serviceFee: Math.round(serviceFee),
        grossEarnings: Math.round(grossEarnings),
      });
    }
  } else if (payouts.length > 0) {
    // Hanya ada Payout (tanpa Reservation detail)
    for (const p of payouts) {
      if (!p.paidOut) { skipped++; continue; }
      bookings.push({
        date: p.date,
        startDate: p.date,
        endDate: p.date,
        nights: 0,
        guest: 'Airbnb Guest',
        paidOut: Math.round(p.paidOut),
        serviceFee: 0,
        grossEarnings: Math.round(p.paidOut),
      });
    }
  }

  if (bookings.length === 0 && rows.length > 0) {
    errors.push(`Tidak ada data booking yang bisa diproses dari ${rows.length} baris CSV`);
  }

  return { bookings, skipped, errors };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
