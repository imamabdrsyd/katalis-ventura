import { describe, it, expect } from 'vitest';
import { parseBcaStatement } from '@/lib/bankStatements/parsers/bca';

/**
 * Sample teks dari PDF mutasi BCA REKENING TAHAPAN April 2026 milik user.
 * Diambil persis dari hasil PDF reader (yang biasanya hampir sama dengan
 * output OCR.space). Tujuannya: validasi parser bisa handle multi-line
 * blok transaksi dengan TANGGAL value-date, KR OTOMATIS multi-line, BI-FAST,
 * dan footer summary.
 */
const SAMPLE_BCA_TEXT = `REKENING TAHAPAN
KCP TAMAN RATU
IMAM ABDURASYID AHMAD
NO. REKENING : 1620012773
HALAMAN :
PERIODE : APRIL 2026
MATA UANG : IDR
TANGGAL KETERANGAN CBG MUTASI SALDO
1 /3
01/04 SALDO AWAL 1,121,000.94
04/04 TRSF E-BANKING DB 0404/FTSCY/WS95271
8000.00
BENI RAMADHAN
8,000.00 DB 1,113,000.94
06/04 TRSF E-BANKING DB
TANGGAL :05/04
0504/FTSCY/WS95271
16000.00
MARIFATUL CHOIR
16,000.00 DB
06/04 KR OTOMATIS LLG-DBS INDONESIA
Payoneer HK
0938 628,355.00 1,725,355.94
07/04 BI-FAST DB BIF TRANSFER KE
542
IMAM ABDURASYID AH
MyBCA
3,172,855.00 DB
17/04 BIAYA ADM 15,000.00 DB 538,000.94
26/04 BI-FAST CR BIF TRANSFER DR
032
VISA PAYMENTS LIMI
989,905.00 1,039,905.94
SALDO AWAL : 1,121,000.94
MUTASI CR : 13,038,260.00 15
MUTASI DB : 11,439,355.00 13
SALDO AKHIR : 2,719,905.94`;

describe('parseBcaStatement', () => {
  it('mengekstrak bank_code BCA dan account_number', () => {
    const parsed = parseBcaStatement(SAMPLE_BCA_TEXT);
    expect(parsed.bank_code).toBe('BCA');
    expect(parsed.account_number).toBe('1620012773');
  });

  it('mengekstrak periode dari header (April 2026)', () => {
    const parsed = parseBcaStatement(SAMPLE_BCA_TEXT);
    expect(parsed.period_start).toBe('2026-04-01');
    expect(parsed.period_end).toBe('2026-04-30');
  });

  it('mengekstrak opening & closing balance dari footer summary', () => {
    const parsed = parseBcaStatement(SAMPLE_BCA_TEXT);
    expect(parsed.opening_balance).toBe(1121000.94);
    expect(parsed.closing_balance).toBe(2719905.94);
    expect(parsed.total_credit).toBe(13038260);
    expect(parsed.total_debit).toBe(11439355);
  });

  it('mendeteksi DB transaction sebagai amount negatif', () => {
    const parsed = parseBcaStatement(SAMPLE_BCA_TEXT);
    // Cari "BIAYA ADM 15,000.00 DB" — paling sederhana
    const biayaAdm = parsed.rows.find(r => r.description === 'BIAYA ADM');
    expect(biayaAdm).toBeDefined();
    expect(biayaAdm!.amount).toBe(-15000);
    expect(biayaAdm!.posted_at).toBe('2026-04-17');
  });

  it('mendeteksi CR transaction sebagai amount positif', () => {
    const parsed = parseBcaStatement(SAMPLE_BCA_TEXT);
    const visaPayment = parsed.rows.find(r => r.counterparty_name?.includes('VISA PAYMENTS'));
    expect(visaPayment).toBeDefined();
    expect(visaPayment!.amount).toBe(989905);
    expect(visaPayment!.description).toBe('BI-FAST CR');
  });

  it('mendeteksi KR OTOMATIS sebagai credit', () => {
    const parsed = parseBcaStatement(SAMPLE_BCA_TEXT);
    const krOtomatis = parsed.rows.find(r => r.description === 'KR OTOMATIS');
    expect(krOtomatis).toBeDefined();
    expect(krOtomatis!.amount).toBeGreaterThan(0);
    expect(krOtomatis!.amount).toBe(628355);
  });

  it('mengekstrak value_date dari "TANGGAL :DD/MM"', () => {
    const parsed = parseBcaStatement(SAMPLE_BCA_TEXT);
    // Row "06/04 TRSF E-BANKING DB TANGGAL :05/04" — value date harus 05/04
    const marifatul = parsed.rows.find(r => r.counterparty_name === 'MARIFATUL CHOIR');
    expect(marifatul).toBeDefined();
    expect(marifatul!.posted_at).toBe('2026-04-06');
    expect(marifatul!.value_date).toBe('2026-04-05');
  });

  it('mengekstrak counterparty name (UPPERCASE multi-token)', () => {
    const parsed = parseBcaStatement(SAMPLE_BCA_TEXT);
    const beni = parsed.rows.find(r => r.posted_at === '2026-04-04');
    expect(beni?.counterparty_name).toBe('BENI RAMADHAN');
  });

  it('mengekstrak reference code FTSCY untuk e-banking', () => {
    const parsed = parseBcaStatement(SAMPLE_BCA_TEXT);
    const beni = parsed.rows.find(r => r.posted_at === '2026-04-04');
    expect(beni?.reference_code).toBe('0404/FTSCY/WS95271');
  });

  it('tidak menganggap baris SALDO AWAL footer sebagai transaksi', () => {
    const parsed = parseBcaStatement(SAMPLE_BCA_TEXT);
    const saldoAwalRow = parsed.rows.find(r => r.description.includes('SALDO AWAL'));
    expect(saldoAwalRow).toBeUndefined();
  });

  it('mengisi validation.warnings ketika total tidak match', () => {
    // Sample hanya berisi sebagian transaksi (bukan semua), jadi sum tidak akan match
    const parsed = parseBcaStatement(SAMPLE_BCA_TEXT);
    expect(parsed.validation).toBeDefined();
    expect(parsed.validation!.warnings.length).toBeGreaterThan(0);
  });
});
