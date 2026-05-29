import type { BankStatementParsed, BankStatementRow } from '../types';

/**
 * Parser untuk PDF mutasi Rekening Tahapan BCA (format yang di-generate dari myBCA / KlikBCA).
 *
 * Struktur file:
 *   - Header alamat + NO. REKENING + PERIODE
 *   - Tabel: TANGGAL | KETERANGAN | CBG | MUTASI | SALDO
 *   - Row pertama: "01/04 SALDO AWAL <opening_balance>"
 *   - Row transaksi multi-line:
 *       <DD/MM> <TYPE> <REF...>
 *       [TANGGAL :<DD/MM>]
 *       <REF_CODE_FTSCY>
 *       <amount_raw>
 *       <COUNTERPARTY>
 *       <amount_formatted> [DB] [saldo_after]
 *   - Footer: SALDO AWAL, MUTASI CR/DB, SALDO AKHIR
 *
 * Strategy: state machine — kumpulkan baris per transaksi sampai ketemu
 * tanggal baru atau footer, lalu parse jadi struktur.
 */

const DATE_PATTERN = /^(\d{2})\/(\d{2})\b/;
const AMOUNT_PATTERN = /[\d,]+\.\d{2}/g;
const TRANSACTION_TYPES = [
  'TRSF E-BANKING DB',
  'TRSF E-BANKING CR',
  'BI-FAST DB',
  'BI-FAST CR',
  'KR OTOMATIS',
  'BIAYA ADM',
  'SETORAN TUNAI',
  'TARIKAN TUNAI',
  'TARIKAN ATM',
  'SWITCHING CR',
  'SWITCHING DB',
  'KARTU DEBIT',
  'TRANSFER',
  'BUNGA',
  'PAJAK BUNGA',
] as const;

type TransactionType = (typeof TRANSACTION_TYPES)[number];

function isTypeLine(line: string): TransactionType | null {
  const upper = line.toUpperCase();
  for (const type of TRANSACTION_TYPES) {
    if (upper.includes(type)) return type;
  }
  return null;
}

/**
 * Apakah type ini debit (uang keluar) atau credit (masuk)?
 * Sebagian besar pakai suffix DB/CR di nama type.
 */
function inferDirection(type: TransactionType, blockText: string): 'DB' | 'CR' {
  // Explicit suffix
  if (/\bDB\b/.test(type)) return 'DB';
  if (/\bCR\b/.test(type)) return 'CR';

  // Heuristic: BIAYA ADM, pajak, biaya → DB
  if (/BIAYA|PAJAK|TARIKAN/.test(type)) return 'DB';
  // KR OTOMATIS (kredit otomatis) → CR
  if (/^KR\b|BUNGA|SETORAN/.test(type)) return 'CR';

  // Fallback: cari "DB" standalone di block
  if (/\bDB\b/.test(blockText)) return 'DB';
  return 'CR';
}

/**
 * Parse tanggal DD/MM + tahun dari periode header.
 * Return ISO YYYY-MM-DD atau undefined kalau gagal.
 */
function parsePostedDate(dmShort: string, year: number): string | undefined {
  const m = dmShort.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return undefined;
  const [, d, mo] = m;
  return `${year}-${mo}-${d}`;
}

/**
 * Parse "PERIODE : APRIL 2026" → { year: 2026, month: 4 }
 */
function parsePeriodHeader(text: string): { year: number; month: number } | null {
  const re = /PERIODE\s*:\s*(JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER|JAN|FEB|MAR|APR|MEI|JUN|JUL|AGU|AGS|SEP|OKT|NOV|DES)\s+(\d{4})/i;
  const m = text.match(re);
  if (!m) return null;
  const monthMap: Record<string, number> = {
    JAN: 1, JANUARI: 1, FEB: 2, FEBRUARI: 2, MAR: 3, MARET: 3,
    APR: 4, APRIL: 4, MEI: 5, JUN: 6, JUNI: 6, JUL: 7, JULI: 7,
    AGU: 8, AGS: 8, AGUSTUS: 8, SEP: 9, SEPTEMBER: 9,
    OKT: 10, OKTOBER: 10, NOV: 11, NOVEMBER: 11, DES: 12, DESEMBER: 12,
  };
  const monthName = m[1].toUpperCase();
  return { year: parseInt(m[2], 10), month: monthMap[monthName] };
}

function parseNumber(s: string): number {
  return parseFloat(s.replace(/,/g, ''));
}

/**
 * Parse satu blok teks (multi-line) yang sudah dikumpulkan jadi BankStatementRow.
 * Blok = baris setelah tanggal sampai sebelum tanggal/footer berikutnya.
 *
 * Contoh blok BCA:
 *   "04/04 TRSF E-BANKING DB 0404/FTSCY/WS95271 8000.00 BENI RAMADHAN 8,000.00 DB 1,113,000.94"
 *
 * Atau multi-line dengan "TANGGAL :":
 *   "06/04 TRSF E-BANKING DB TANGGAL :05/04 0504/FTSCY/WS95271 16000.00 MARIFATUL CHOIR 16,000.00 DB"
 *
 * Atau KR OTOMATIS:
 *   "06/04 KR OTOMATIS LLG-DBS INDONESIA Payoneer HK id:100035310 name: Airbnb Payments UK Limited ad 0938 628,355.00 1,725,355.94"
 */
function parseTransactionBlock(
  block: string,
  year: number
): BankStatementRow | null {
  const dateMatch = block.match(DATE_PATTERN);
  if (!dateMatch) return null;
  const posted_at = parsePostedDate(`${dateMatch[1]}/${dateMatch[2]}`, year);
  if (!posted_at) return null;

  const type = isTypeLine(block);
  if (!type) return null;

  // Value date (kalau ada "TANGGAL :DD/MM")
  let value_date: string | undefined;
  const valueDateMatch = block.match(/TANGGAL\s*:\s*(\d{2})\/(\d{2})/);
  if (valueDateMatch) {
    value_date = parsePostedDate(`${valueDateMatch[1]}/${valueDateMatch[2]}`, year);
  }

  // Reference code:
  // - E-banking: 0404/FTSCY/WS95271
  // - BI-FAST: BIF TRANSFER KE 542 / BIF TRANSFER DR 028 / BIF BIAYA TXN KE 542
  // - LLG: LLG-DBS INDONESIA / LLG-BNI
  let reference_code: string | undefined;
  const ftscy = block.match(/\d{4}\/FTSCY\/\w+/);
  const biFast = block.match(/BIF\s+(TRANSFER|BIAYA)[A-Z\s]*\d{3}/);
  const llg = block.match(/LLG-[A-Z]+(?:\s+[A-Z]+)?/);
  if (ftscy) reference_code = ftscy[0];
  else if (biFast) reference_code = biFast[0].trim();
  else if (llg) reference_code = llg[0];

  // Amounts: cari semua angka dengan format ribuan + 2 desimal
  // Heuristic: nominal terbesar pertama biasanya = amount, terakhir = saldo
  const amounts = Array.from(block.matchAll(AMOUNT_PATTERN)).map(m => ({
    raw: m[0],
    value: parseNumber(m[0]),
    index: m.index ?? 0,
  }));

  if (amounts.length === 0) return null;

  // Direction: cek apakah ada "DB" yang dekat dengan salah satu amount
  const direction = inferDirection(type, block);

  // Amount = angka terkecil yang bukan saldo, atau angka tertentu
  // Strategy: posisi "DB" jadi acuan. Amount = angka tepat SEBELUM atau dengan "DB" suffix.
  // Saldo = angka terakhir di block.
  //
  // Pola umum:
  //   "... 16,000.00 DB 1,113,000.94"  → amount=16000, saldo=1113000.94
  //   "... 16,000.00 DB"               → amount=16000, saldo=undefined
  //   "... 800,000.00"                 → amount=800000 (CR), saldo undefined / di amounts[0]
  let amountValue: number | undefined;
  let saldo: number | undefined;

  // Cari posisi "DB" TERAKHIR — di BCA, "DB" sering muncul 2x:
  // (1) di nama type "TRSF E-BANKING DB" di awal block
  // (2) sebagai marker amount: "<amount_formatted> DB <saldo>" di akhir
  // Yang kita mau adalah occurrence #2.
  const dbMatches = Array.from(block.matchAll(/\bDB\b/g));
  if (dbMatches.length > 0) {
    const lastDb = dbMatches[dbMatches.length - 1];
    const dbIdx = lastDb.index ?? 0;
    // Amount = angka terakhir SEBELUM "DB" terakhir
    const before = amounts.filter(a => a.index < dbIdx);
    if (before.length > 0) amountValue = before[before.length - 1].value;
    // Saldo = angka SETELAH "DB" terakhir (kalau ada)
    const after = amounts.filter(a => a.index > dbIdx);
    if (after.length > 0) saldo = after[after.length - 1].value;
  } else {
    // CR tanpa "DB" marker — amount = angka terakhir kedua atau pertama
    // Pola: "amount_formatted saldo_after" atau cuma "amount_formatted"
    if (amounts.length >= 2) {
      // Bisa jadi: amount_raw amount_formatted saldo, atau amount_formatted saldo
      // Cari amount yang muncul 2x (raw vs formatted) — itu = amount
      const valueCounts = new Map<number, number>();
      for (const a of amounts) valueCounts.set(a.value, (valueCounts.get(a.value) ?? 0) + 1);
      const duplicates = Array.from(valueCounts.entries()).filter(([, c]) => c >= 2);
      if (duplicates.length > 0) {
        amountValue = duplicates[0][0];
        // Saldo = angka selain duplicate, ambil yang terakhir
        const nonDup = amounts.filter(a => a.value !== amountValue);
        if (nonDup.length > 0) saldo = nonDup[nonDup.length - 1].value;
      } else {
        // No duplicate — anggap [amount, saldo] sebagai 2 angka terakhir
        amountValue = amounts[amounts.length - 2].value;
        saldo = amounts[amounts.length - 1].value;
      }
    } else {
      amountValue = amounts[0].value;
    }
  }

  if (amountValue === undefined) return null;

  // Counterparty: cari nama dalam UPPERCASE multi-kata yang BUKAN type/ref code
  // Strategy: split block by whitespace, kumpulkan token UPPERCASE berturut-turut
  // yang panjangnya ≥ 3 huruf dan bukan keyword sistem.
  const counterparty = extractCounterparty(block, type);

  // Description: bersihkan dari noise. Pakai type sebagai dasar + reference code.
  const description = type;

  return {
    posted_at,
    value_date,
    description,
    amount: direction === 'DB' ? -amountValue : amountValue,
    running_balance: saldo,
    reference_code,
    counterparty_name: counterparty,
  };
}

const COUNTERPARTY_BLACKLIST = new Set([
  'TRSF', 'BANKING', 'BI', 'FAST', 'KR', 'OTOMATIS', 'BIAYA', 'ADM',
  'DB', 'CR', 'TANGGAL', 'BIF', 'TRANSFER', 'KE', 'DR', 'LLG', 'TXN',
  'MYBCA', 'MY', 'BCA',
]);

function extractCounterparty(block: string, type: string): string | undefined {
  const cleaned = block.replace(type, ' ').replace(/TANGGAL\s*:\d{2}\/\d{2}/g, ' ');
  const tokens = cleaned.split(/\s+/);

  // Kumpulkan run dari token UPPERCASE berturut-turut yang bukan blacklist
  const candidates: string[] = [];
  let current: string[] = [];

  for (const tok of tokens) {
    const clean = tok.replace(/[^\w]/g, '');
    if (!clean) {
      if (current.length >= 2) candidates.push(current.join(' '));
      current = [];
      continue;
    }
    const isUpper = clean === clean.toUpperCase() && /[A-Z]/.test(clean);
    const isBlacklist = COUNTERPARTY_BLACKLIST.has(clean.toUpperCase());
    const isNumeric = /^\d/.test(clean);
    const isCode = /^[A-Z]+\d+$/.test(clean); // mis. WS95271

    if (isUpper && !isBlacklist && !isNumeric && !isCode && clean.length >= 3) {
      current.push(clean);
    } else {
      if (current.length >= 2) candidates.push(current.join(' '));
      current = [];
    }
  }
  if (current.length >= 2) candidates.push(current.join(' '));

  // Pilih kandidat terpanjang
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

/**
 * Parser utama untuk PDF mutasi BCA.
 * Input: raw text hasil OCR.
 */
export function parseBcaStatement(rawText: string): BankStatementParsed {
  const period = parsePeriodHeader(rawText);
  const year = period?.year ?? new Date().getFullYear();

  // Account number
  let account_number: string | undefined;
  const accMatch = rawText.match(/NO\.\s*REKENING\s*:\s*(\d+)/i);
  if (accMatch) account_number = accMatch[1];

  // Split jadi baris, bersihkan
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Identifikasi range "BODY" — antara header tabel dan footer summary
  let bodyStart = -1;
  let bodyEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (/TANGGAL\s+KETERANGAN.*MUTASI.*SALDO/i.test(lines[i])) {
      bodyStart = i + 1;
    }
    // Footer marker
    if (/^SALDO\s+AWAL\s*:/i.test(lines[i]) && bodyStart > 0) {
      // Tapi cek: kalau baris ini adalah "SALDO AWAL" di footer, bukan di body row pertama
      // Body row pertama formatnya "01/04 SALDO AWAL ..." dengan tanggal di depan.
      if (!DATE_PATTERN.test(lines[i])) {
        bodyEnd = i;
        break;
      }
    }
  }

  if (bodyStart === -1) {
    // Fallback: cari baris pertama yang start dengan DD/MM
    for (let i = 0; i < lines.length; i++) {
      if (DATE_PATTERN.test(lines[i])) {
        bodyStart = i;
        break;
      }
    }
  }

  // Kumpulkan transaksi sebagai block: dari satu baris-DD/MM sampai baris-DD/MM berikutnya
  const blocks: string[] = [];
  let currentBlock: string[] = [];

  for (let i = bodyStart; i < bodyEnd; i++) {
    const line = lines[i];
    // Skip noise
    if (/Bersambung ke halaman/i.test(line)) continue;
    if (/^\d+\s*\/\s*\d+$/.test(line)) continue; // halaman X/Y
    if (/^TANGGAL\s+KETERANGAN/i.test(line)) continue; // re-header per halaman
    if (/CATATAN:/i.test(line)) continue;
    if (/Apabila nasabah|BCA berhak|Laporan Mutasi/i.test(line)) continue;

    if (DATE_PATTERN.test(line)) {
      if (currentBlock.length > 0) blocks.push(currentBlock.join(' '));
      currentBlock = [line];
    } else if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) blocks.push(currentBlock.join(' '));

  // Parse opening balance dari row pertama "DD/MM SALDO AWAL <amount>"
  let opening_balance: number | undefined;
  const rows: BankStatementRow[] = [];

  for (const block of blocks) {
    if (/SALDO\s+AWAL/i.test(block)) {
      const amounts = Array.from(block.matchAll(AMOUNT_PATTERN));
      if (amounts.length > 0) opening_balance = parseNumber(amounts[amounts.length - 1][0]);
      continue;
    }
    const row = parseTransactionBlock(block, year);
    if (row) rows.push(row);
  }

  // Parse footer summary
  const footerText = lines.slice(bodyEnd).join('\n');
  let closing_balance: number | undefined;
  let total_credit: number | undefined;
  let total_debit: number | undefined;

  const closingMatch = footerText.match(/SALDO\s+AKHIR\s*:\s*([\d,]+\.\d{2})/i);
  if (closingMatch) closing_balance = parseNumber(closingMatch[1]);

  const crMatch = footerText.match(/MUTASI\s+CR\s*:\s*([\d,]+\.\d{2})/i);
  if (crMatch) total_credit = parseNumber(crMatch[1]);

  const dbMatch = footerText.match(/MUTASI\s+DB\s*:\s*([\d,]+\.\d{2})/i);
  if (dbMatch) total_debit = parseNumber(dbMatch[1]);

  const openingMatch = footerText.match(/SALDO\s+AWAL\s*:\s*([\d,]+\.\d{2})/i);
  if (openingMatch && opening_balance === undefined) {
    opening_balance = parseNumber(openingMatch[1]);
  }

  // Period: kalau ada periode di header, mulai = awal bulan, akhir = akhir bulan
  let period_start: string | undefined;
  let period_end: string | undefined;
  if (period) {
    period_start = `${period.year}-${String(period.month).padStart(2, '0')}-01`;
    const lastDay = new Date(period.year, period.month, 0).getDate();
    period_end = `${period.year}-${String(period.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else if (rows.length > 0) {
    period_start = rows[0].posted_at;
    period_end = rows[rows.length - 1].posted_at;
  }

  const parsed: BankStatementParsed = {
    bank_code: 'BCA',
    account_number,
    period_start,
    period_end,
    opening_balance,
    closing_balance,
    total_credit,
    total_debit,
    rows,
  };

  parsed.validation = validateStatement(parsed);
  return parsed;
}

/**
 * Validasi: opening + sum(credit) - sum(debit) ≈ closing.
 * Pakai tolerance Rp 1 untuk antisipasi floating point.
 */
function validateStatement(parsed: BankStatementParsed): NonNullable<BankStatementParsed['validation']> {
  const warnings: string[] = [];
  const sumCredit = parsed.rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const sumDebit = parsed.rows.filter(r => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);

  if (parsed.total_credit !== undefined && Math.abs(sumCredit - parsed.total_credit) > 1) {
    warnings.push(
      `Total CR tidak cocok: parsed Rp ${sumCredit.toLocaleString('id-ID')} vs file Rp ${parsed.total_credit.toLocaleString('id-ID')}`
    );
  }
  if (parsed.total_debit !== undefined && Math.abs(sumDebit - parsed.total_debit) > 1) {
    warnings.push(
      `Total DB tidak cocok: parsed Rp ${sumDebit.toLocaleString('id-ID')} vs file Rp ${parsed.total_debit.toLocaleString('id-ID')}`
    );
  }

  let expected_closing: number | undefined;
  let diff: number | undefined;
  let is_balanced = true;
  if (parsed.opening_balance !== undefined) {
    expected_closing = parsed.opening_balance + sumCredit - sumDebit;
    if (parsed.closing_balance !== undefined) {
      diff = parsed.closing_balance - expected_closing;
      if (Math.abs(diff) > 1) {
        is_balanced = false;
        warnings.push(
          `Saldo akhir tidak cocok: diharapkan Rp ${expected_closing.toLocaleString('id-ID')}, tapi file menulis Rp ${parsed.closing_balance.toLocaleString('id-ID')}`
        );
      }
    }
  }

  return { is_balanced, expected_closing, diff, warnings };
}
