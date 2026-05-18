import { describe, expect, it } from 'vitest';
import {
  parseDate,
  parseTotal,
  parseVendor,
  parseReceipt,
  inferCategory,
  parseCurrency,
} from '@/lib/ocr/parser';

describe('parseDate', () => {
  it('parses dd/mm/yyyy', () => {
    expect(parseDate('Tanggal: 18/05/2026')).toBe('2026-05-18');
  });

  it('parses dd-mm-yyyy', () => {
    expect(parseDate('05-12-2026')).toBe('2026-12-05');
  });

  it('parses dd.mm.yyyy', () => {
    expect(parseDate('Tgl 02.01.2026 jam 10:30')).toBe('2026-01-02');
  });

  it('parses ISO yyyy-mm-dd', () => {
    expect(parseDate('Date: 2026-05-18 10:30')).toBe('2026-05-18');
  });

  it('parses Indonesian month name with full year', () => {
    expect(parseDate('Tanggal: 12 Mei 2026')).toBe('2026-05-12');
    expect(parseDate('5 Januari 2026')).toBe('2026-01-05');
    expect(parseDate('20 Desember 2026')).toBe('2026-12-20');
  });

  it('parses Indonesian month name with 2-digit year', () => {
    expect(parseDate('12 Mei 26')).toBe('2026-05-12');
  });

  it('parses abbreviated Indonesian month', () => {
    expect(parseDate('15 Agu 2026')).toBe('2026-08-15');
    expect(parseDate('3 Okt 2026')).toBe('2026-10-03');
  });

  it('parses dd/mm/yy short year', () => {
    expect(parseDate('18/05/26')).toBe('2026-05-18');
  });

  it('returns undefined for no date', () => {
    expect(parseDate('TOTAL Rp 150.000')).toBeUndefined();
  });
});

describe('parseTotal', () => {
  it('parses total with Indonesian thousand separator (dot)', () => {
    const text = 'TOTAL Rp 150.000';
    expect(parseTotal(text)).toBe(150_000);
  });

  it('parses total with comma thousand separator', () => {
    expect(parseTotal('TOTAL: Rp 1,500,000')).toBe(1_500_000);
  });

  it('parses large total with multiple dots', () => {
    expect(parseTotal('TOTAL BAYAR Rp 2.750.500')).toBe(2_750_500);
  });

  it('parses "total bayar" line', () => {
    const text = `
      Roti Tawar  15.000
      Susu        12.500
      ----
      Total Bayar 27.500
    `;
    expect(parseTotal(text)).toBe(27_500);
  });

  it('parses "jumlah" keyword', () => {
    expect(parseTotal('Jumlah 50.000')).toBe(50_000);
  });

  it('prefers "total" line over subtotal', () => {
    const text = `
      Sub Total   100.000
      PPN 11%     11.000
      Total       111.000
    `;
    expect(parseTotal(text)).toBe(111_000);
  });

  it('skips subtotal-only lines', () => {
    const text = 'SUBTOTAL 50.000';
    // Tidak ada baris dengan keyword "total" murni, fallback ke largest number
    expect(parseTotal(text)).toBe(50_000);
  });

  it('handles total on next line', () => {
    const text = 'TOTAL\nRp 250.000';
    expect(parseTotal(text)).toBe(250_000);
  });

  it('returns undefined for no numbers >= 1000', () => {
    expect(parseTotal('Terima kasih')).toBeUndefined();
  });

  it('skips small numbers (< 1000) as fallback', () => {
    expect(parseTotal('Item 5\nQty 2')).toBeUndefined();
  });

  it('parses Rp-prefixed amount without total keyword (digital receipt heading)', () => {
    const text = 'Pembayaran Berhasil\n\nRp 316.350\n\nDetail Transaksi';
    expect(parseTotal(text)).toBe(316_350);
  });

  it('skips invoice/reference numbers when finding total', () => {
    const text = `
      Pembayaran Berhasil
      Rp 316.350
      No. Transaksi: INV-1778575615348
      Periode: Mei 2026
    `;
    expect(parseTotal(text)).toBe(316_350); // bukan 1778575615348
  });

  it('rejects unrealistic amounts (> 10 billion)', () => {
    // Plain digit string seperti "1778575615348" — bukan Rp formatted
    const text = 'INV1778575615348\nBeli barang';
    expect(parseTotal(text)).toBeUndefined();
  });

  it('skips subtotal/diskon lines even when Rp-prefixed', () => {
    const text = `
      Subtotal Rp 100.000
      Diskon Rp 10.000
      Total: Rp 90.000
    `;
    expect(parseTotal(text)).toBe(90_000);
  });

  it('parses USD formatted totals with comma thousands and dot decimals', () => {
    expect(parseTotal('TOTAL USD 1,234.56')).toBe(1234.56);
  });
});

describe('parseCurrency', () => {
  it('detects IDR and USD currency markers', () => {
    expect(parseCurrency('TOTAL Rp 150.000')).toBe('IDR');
    expect(parseCurrency('TOTAL USD 1,234.56')).toBe('USD');
  });

  it('includes detected currency in parseReceipt output', () => {
    const result = parseReceipt('Amazon\nTOTAL $12.50');
    expect(result.currency_code).toBe('USD');
    expect(result.total).toBe(12.5);
  });
});

describe('parseVendor', () => {
  it('returns first non-noise line', () => {
    const text = 'INDOMARET\nJl. Sudirman No. 10\n18/05/2026\nTOTAL 150.000';
    expect(parseVendor(text)).toBe('INDOMARET');
  });

  it('skips lines starting with numbers', () => {
    const text = '12345-001\nALFAMART CABANG PUSAT\nJl. Thamrin';
    expect(parseVendor(text)).toBe('ALFAMART CABANG PUSAT');
  });

  it('skips address lines', () => {
    const text = 'Jl. Sudirman 123\nWarung Bu Tini\nTotal 50.000';
    expect(parseVendor(text)).toBe('Warung Bu Tini');
  });

  it('skips phone/contact lines', () => {
    const text = 'Telp: 021-12345\nToko Maju Jaya';
    expect(parseVendor(text)).toBe('Toko Maju Jaya');
  });

  it('returns undefined when no candidate found', () => {
    expect(parseVendor('123\n456\n789')).toBeUndefined();
  });

  it('skips greeting/thank-you bubble', () => {
    const text = 'Thank you!\nWarung Sederhana\nRp 50.000';
    expect(parseVendor(text)).toBe('Warung Sederhana');
  });

  it('skips Indonesian greeting variations', () => {
    expect(parseVendor('Terima Kasih\nKedai Kopi Mantap')).toBe('Kedai Kopi Mantap');
  });

  it('skips Rp-prefix lines (those are amounts)', () => {
    expect(parseVendor('Rp 316.350\nIndomaret')).toBe('Indomaret');
  });

  it('skips generic transaction header words', () => {
    const text = 'Pembayaran Berhasil\nBill Payment Successful\nTelkomsel';
    expect(parseVendor(text)).toBe('Telkomsel');
  });
});

describe('parseVendor key:value pattern', () => {
  it('extracts vendor from "Jenis Transaksi: Telkomsel"', () => {
    const text = `
Pembayaran Berhasil
Rp 316.350
Jenis Transaksi: Telkomsel
No. Transaksi: INV-1234567
    `;
    expect(parseVendor(text)).toBe('Telkomsel');
  });

  it('extracts vendor from "Merchant: Tokopedia"', () => {
    expect(parseVendor('Purchase Successful\nMerchant: Tokopedia\nRp 50.000')).toBe('Tokopedia');
  });

  it('extracts vendor from "Toko: Warung Maju"', () => {
    expect(parseVendor('Toko: Warung Maju\nTotal 30.000')).toBe('Warung Maju');
  });

  it('extracts vendor from "Provider: XL Axiata"', () => {
    expect(parseVendor('Pembayaran Berhasil\nProvider: XL Axiata\nRp 100.000')).toBe('XL Axiata');
  });

  it('key:value takes priority over top-line scan', () => {
    const text = `Pembayaran Berhasil
Bill Payment Successful
Jenis Transaksi: Telkomsel
INDOMARET
    `;
    expect(parseVendor(text)).toBe('Telkomsel');
  });
});

describe('inferCategory', () => {
  it('returns OPEX for Telkomsel', () => {
    expect(inferCategory('Telkomsel')).toBe('OPEX');
  });

  it('returns OPEX for PLN', () => {
    expect(inferCategory('PLN')).toBe('OPEX');
  });

  it('returns OPEX for Indomaret', () => {
    expect(inferCategory('Indomaret')).toBe('OPEX');
  });

  it('returns VAR for Tokopedia (marketplace)', () => {
    expect(inferCategory('Tokopedia')).toBe('VAR');
  });

  it('returns FIN for BCA', () => {
    expect(inferCategory('BCA')).toBe('FIN');
  });

  it('returns TAX for BPJS', () => {
    expect(inferCategory('BPJS')).toBe('TAX');
  });

  it('returns undefined for unknown vendor', () => {
    expect(inferCategory('Warung Bu Tini')).toBeUndefined();
  });

  it('falls back to raw_text when vendor undefined', () => {
    expect(inferCategory(undefined, 'Bayar tagihan Telkomsel 100.000')).toBe('OPEX');
  });

  it('parseReceipt includes inferred category for known vendor', () => {
    const text = `
Jenis Transaksi: Telkomsel
Rp 316.350
18/05/2026
    `;
    const result = parseReceipt(text);
    expect(result.vendor).toBe('Telkomsel');
    expect(result.category).toBe('OPEX');
  });

  it('parseReceipt category is undefined for unknown vendor', () => {
    const result = parseReceipt('Warung Bu Tini\n12 Mei 2026\nTotal: 30.000');
    expect(result.category).toBeUndefined();
  });
});

describe('parseReceipt (integration)', () => {
  it('parses Indomaret-style receipt', () => {
    const text = `
INDOMARET
Jl. Sudirman No. 10
NPWP: 01.234.567.8-901.000

18/05/2026 10:30
Kasir: Andi

Roti Tawar Sari Roti        15.000
Susu UHT 1L                 18.500
Indomie Goreng 5pcs         12.500

SUB TOTAL                   46.000
PPN 11%                      5.060
-------------------------------
TOTAL                       51.060
Tunai                       60.000
Kembali                      8.940

TERIMA KASIH
    `;
    const result = parseReceipt(text);
    expect(result.date).toBe('2026-05-18');
    expect(result.total).toBe(51_060);
    expect(result.vendor).toBe('INDOMARET');
  });

  it('parses warung-style handwritten receipt', () => {
    const text = `
Warung Bu Tini
12 Mei 2026

Nasi Goreng    25.000
Es Teh         5.000

Total: 30.000
    `;
    const result = parseReceipt(text);
    expect(result.date).toBe('2026-05-12');
    expect(result.total).toBe(30_000);
    expect(result.vendor).toBe('Warung Bu Tini');
  });

  it('returns undefined fields gracefully when input is garbage', () => {
    const result = parseReceipt('asdf qwerty');
    expect(result.date).toBeUndefined();
    expect(result.total).toBeUndefined();
    expect(result.vendor).toBe('asdf qwerty');
  });
});
