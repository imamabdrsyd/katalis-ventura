import { describe, it, expect } from 'vitest';
import { parseSheetValues, type SheetCell } from '@/lib/import/sheetsParser';

/**
 * Sheets API mengembalikan bentuk yang lebih "mentah" dari XLSX: baris ragged,
 * header duplikat tidak dibedakan, dan sel kosong di ujung baris dipangkas.
 * Test di sini mengunci penanganan keempat kasus itu.
 */
describe('parseSheetValues', () => {
  it('memetakan header ke ParsedRow lewat tabel EN/ID', () => {
    const values: SheetCell[][] = [
      ['Tanggal', 'Keterangan', 'Jumlah'],
      ['2026-01-15', 'Bayar listrik', 250000],
    ];

    const result = parseSheetValues(values);

    expect(result.headers).toEqual(['Tanggal', 'Keterangan', 'Jumlah']);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].date).toBe('2026-01-15');
    expect(result.parsed[0].description).toBe('Bayar listrik');
    expect(result.parsed[0].amount).toBe(250000);
  });

  it('mempertahankan angka sebagai number (bukan string berformat)', () => {
    // Ini alasan kita memakai valueRenderOption=UNFORMATTED_VALUE: string
    // "1.500.000,50" akan dirusak oleh sanitizeAmount jadi 150000050.
    const values: SheetCell[][] = [
      ['Tanggal', 'Deskripsi', 'Nominal'],
      ['2026-02-01', 'Penjualan', 1500000.5],
    ];

    const result = parseSheetValues(values);

    expect(result.parsed[0].amount).toBe(1500000.5);
    expect(typeof result.parsed[0].amount).toBe('number');
  });

  it('memberi nama unik pada header duplikat agar tidak ada kolom hilang', () => {
    const values: SheetCell[][] = [
      ['Deskripsi', 'Total', 'Total'],
      ['Sewa', 100, 200],
    ];

    const result = parseSheetValues(values);

    expect(result.headers).toEqual(['Deskripsi', 'Total', 'Total (2)']);
    expect(result.rows[0]['Total']).toBe(100);
    expect(result.rows[0]['Total (2)']).toBe(200);
  });

  it('memberi nama pada header kosong', () => {
    const values: SheetCell[][] = [
      ['Tanggal', '', '   '],
      ['2026-03-01', 'a', 'b'],
    ];

    const result = parseSheetValues(values);

    expect(result.headers).toEqual(['Tanggal', 'Kolom 2', 'Kolom 3']);
  });

  it('mem-pad baris ragged ke lebar header', () => {
    // Sheets API memangkas sel kosong di ujung baris — baris pendek TIDAK
    // berarti kolomnya tidak ada.
    const values: SheetCell[][] = [
      ['Tanggal', 'Deskripsi', 'Nominal'],
      ['2026-01-01'],
      ['2026-01-02', 'Ada deskripsi'],
    ];

    const result = parseSheetValues(values);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ Tanggal: '2026-01-01', Deskripsi: '', Nominal: '' });
    expect(result.rows[1].Nominal).toBe('');
  });

  it('melewati baris yang seluruh selnya kosong', () => {
    const values: SheetCell[][] = [
      ['Tanggal', 'Deskripsi', 'Nominal'],
      ['2026-01-01', 'Beli ATK', 50000],
      ['', '', ''],
      [null, null, null],
      [],
      ['2026-01-03', 'Beli kertas', 75000],
    ];

    const result = parseSheetValues(values);

    expect(result.rows).toHaveLength(2);
    expect(result.skippedEmptyRows).toBe(3);
    expect(result.totalDataRows).toBe(5);
  });

  it('mengembalikan hasil kosong untuk sheet kosong atau hanya header', () => {
    expect(parseSheetValues([]).parsed).toEqual([]);
    expect(parseSheetValues([['Tanggal', 'Nominal']]).parsed).toEqual([]);
    expect(parseSheetValues([['Tanggal', 'Nominal']]).headers).toEqual(['Tanggal', 'Nominal']);
  });

  it('menghormati headerRowIndex saat tabel tidak mulai di baris pertama', () => {
    const values: SheetCell[][] = [
      ['Laporan Kas Bulanan'],
      [],
      ['Tanggal', 'Deskripsi', 'Nominal'],
      ['2026-04-01', 'Setoran', 900000],
    ];

    const result = parseSheetValues(values, { headerRowIndex: 2 });

    expect(result.headers).toEqual(['Tanggal', 'Deskripsi', 'Nominal']);
    expect(result.rows).toHaveLength(1);
    expect(result.parsed[0].amount).toBe(900000);
  });
});
