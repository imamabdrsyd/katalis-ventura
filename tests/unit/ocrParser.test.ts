import { describe, expect, it } from 'vitest';
import {
  parseDate,
  parseTotal,
  parseVendor,
  parseReceipt,
  inferCategory,
  parseCurrency,
  parseLineItems,
  parseCharges,
  extractLineItemKeywords,
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
  it('returns first non-noise line (normalized to Title Case)', () => {
    const text = 'INDOMARET\nJl. Sudirman No. 10\n18/05/2026\nTOTAL 150.000';
    expect(parseVendor(text)).toBe('Indomaret');
  });

  it('skips lines starting with numbers', () => {
    const text = '12345-001\nALFAMART CABANG PUSAT\nJl. Thamrin';
    // Brand pattern "alfamart" match → output Title Case
    expect(parseVendor(text)).toBe('Alfamart');
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

describe('parseTotal USD/foreign currency', () => {
  it('parses $20.00', () => {
    expect(parseTotal('Invoice paid\n$20.00\nPayment date: May 17, 2026')).toBe(20);
  });

  it('parses USD 1,500.00', () => {
    expect(parseTotal('Amount Due: USD 1,500.00')).toBe(1500);
  });

  it('parses $1,234.56 (preserves decimals)', () => {
    expect(parseTotal('Total: $1,234.56')).toBe(1234.56);
  });

  it('parses amount paid keyword in English invoice', () => {
    expect(parseTotal('Amount Paid\n$20.00\nInvoice number: JDTEECME-0009')).toBe(20);
  });
});

describe('parseVendor leading single char', () => {
  it('strips single leading char from OCR logo misread', () => {
    // OCR baca logo "A" Anthropic sebagai teks
    expect(parseVendor('A Anthropic, PBC\nInvoice paid\n$20.00')).toBe('Anthropic, PBC');
  });

  it('does not strip multi-char prefix', () => {
    expect(parseVendor('PT Maju Jaya\nTotal 50.000')).toBe('PT Maju Jaya');
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
    expect(result.vendor).toBe('Indomaret');
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

describe('parseLineItems', () => {
  it('parses simple "deskripsi nominal" rows', () => {
    const text = `
Warung Bu Tini
12 Mei 2026

Nasi Goreng       25.000
Es Teh Manis      5.000
Kerupuk Udang     3.000

Total: 33.000
    `;
    const items = parseLineItems(text);
    expect(items.length).toBeGreaterThanOrEqual(3);
    const descs = items.map((i) => i.description);
    expect(descs).toContain('Nasi Goreng');
    expect(descs).toContain('Es Teh Manis');
    expect(descs).toContain('Kerupuk Udang');
    expect(items.find((i) => i.description === 'Nasi Goreng')?.amount).toBe(25_000);
  });

  it('strips total/subtotal/tax lines from item list', () => {
    const text = `
Beras Premium    50.000
Minyak Goreng    30.000
Subtotal         80.000
PPN 11%          8.800
Total           88.800
    `;
    const items = parseLineItems(text);
    const descs = items.map((i) => i.description.toLowerCase());
    expect(descs).toContain('beras premium');
    expect(descs).toContain('minyak goreng');
    expect(descs.some((d) => d.includes('total'))).toBe(false);
    expect(descs.some((d) => d.includes('ppn'))).toBe(false);
  });

  it('parses qty x item format', () => {
    const text = `
2x Indomie Goreng    7.000
3 pcs Aqua 600ml     15.000
    `;
    const items = parseLineItems(text);
    expect(items.length).toBeGreaterThanOrEqual(2);
    const indomie = items.find((i) => i.description.toLowerCase().includes('indomie'));
    expect(indomie?.quantity).toBe(2);
  });

  it('parses qty unit_price total format', () => {
    const text = `
Kopi Susu      2   25.000   50.000
Roti Bakar     1   15.000   15.000
    `;
    const items = parseLineItems(text);
    expect(items.length).toBe(2);
    const kopi = items.find((i) => i.description.toLowerCase().includes('kopi'));
    expect(kopi?.quantity).toBe(2);
    expect(kopi?.unit_price).toBe(25_000);
    expect(kopi?.amount).toBe(50_000);
  });

  it('attaches semantic keywords per item', () => {
    const text = `
Beras Premium 5kg    50.000
Sabun Lifebuoy        15.000
    `;
    const items = parseLineItems(text);
    const beras = items.find((i) => i.description.toLowerCase().includes('beras'));
    const sabun = items.find((i) => i.description.toLowerCase().includes('sabun'));
    expect(beras?.keywords).toContain('bahan pokok');
    expect(sabun?.keywords).toContain('perlengkapan');
  });

  it('returns empty array for receipt without line items', () => {
    expect(parseLineItems('Total: 50.000')).toEqual([]);
    expect(parseLineItems('')).toEqual([]);
  });

  it('parses POS-style "ITEM Nx PRICE" format (restoran/cafe)', () => {
    const text = `
Order Details
Item Name        Qty    Price
SEKAR CAN        1x     39.000
ICE AMERICANO    1x     32.000
NASI GORENG MAMAK 1x    60.000
AIR MINERAL      2x     36.000
PISANG GORENG MADU 1x   35.000
Total Item       8     299.000
    `;
    const items = parseLineItems(text);
    const descs = items.map((i) => i.description);
    expect(descs).toContain('SEKAR CAN');
    expect(descs).toContain('ICE AMERICANO');
    expect(descs).toContain('NASI GORENG MAMAK');
    expect(descs).toContain('AIR MINERAL');
    const air = items.find((i) => i.description === 'AIR MINERAL');
    expect(air?.quantity).toBe(2);
    expect(air?.amount).toBe(36_000);
    // "Total Item" harus terstrip karena ada keyword "total"
    expect(descs.some((d) => d.toLowerCase().includes('total'))).toBe(false);
  });
});

describe('parseCharges', () => {
  it('detects PPN/tax line', () => {
    const text = `
Subtotal      100.000
PPN 11%        11.000
Total         111.000
    `;
    const charges = parseCharges(text);
    const tax = charges.find((c) => c.type === 'tax');
    expect(tax).toBeDefined();
    expect(tax?.amount).toBe(11_000);
    expect(tax?.keywords).toContain('pajak');
  });

  it('detects service charge', () => {
    const text = `
Subtotal           100.000
Service Charge       5.000
PPN 11%             11.550
Total              116.550
    `;
    const charges = parseCharges(text);
    const service = charges.find((c) => c.type === 'service');
    expect(service?.amount).toBe(5_000);
  });

  it('detects discount as negative amount', () => {
    const text = `
Subtotal       100.000
Diskon 10%      10.000
Total           90.000
    `;
    const charges = parseCharges(text);
    const discount = charges.find((c) => c.type === 'discount');
    expect(discount?.amount).toBe(-10_000);
  });
});

describe('extractLineItemKeywords', () => {
  it('detects sembako keywords', () => {
    expect(extractLineItemKeywords('Beras Premium 5kg')).toContain('bahan pokok');
    expect(extractLineItemKeywords('Minyak Goreng Bimoli')).toContain('bahan pokok');
  });

  it('detects supplies keywords', () => {
    expect(extractLineItemKeywords('Sabun Lifebuoy')).toContain('perlengkapan');
    expect(extractLineItemKeywords('Tissue Paseo 250 sheet')).toContain('perlengkapan');
  });

  it('returns empty for unknown items', () => {
    expect(extractLineItemKeywords('Barang Aneh XYZ')).toEqual([]);
  });
});

describe('parseReceipt — multi-line integration', () => {
  it('returns line_items and charges on multi-item receipt', () => {
    const text = `
Indomaret Cabang Sudirman
20 Mei 2026

Beras Premium 5kg    65.000
Minyak Goreng 2L     35.000
Sabun Lifebuoy       12.000

Subtotal            112.000
PPN 11%              12.320
Total              124.320
    `;
    const result = parseReceipt(text);
    expect(result.line_items?.length).toBeGreaterThanOrEqual(3);
    expect(result.charges?.length).toBeGreaterThanOrEqual(1);
    expect(result.charges?.find((c) => c.type === 'tax')).toBeDefined();
    expect(result.total).toBe(124_320);
  });

  it('returns undefined line_items for single-purpose receipt', () => {
    const text = `
PLN
Tagihan listrik
Total: Rp 250.000
    `;
    const result = parseReceipt(text);
    // PLN bill biasanya tidak punya line items detail
    expect(result.line_items).toBeUndefined();
  });

  it('parses Google Vision multi-column layout (qty/price/name di baris terpisah)', () => {
    // Raw text aktual dari Google Vision untuk struk Kopi Nusantara
    const text = `tomer Name
Mufti Syahidi
22.25
66
Membership
Mufti Syahidi
Phone Number
0919-1901-049
<
Table Number
015
Order Details
Item Name
Qty
Price
1x
39.000
SEKAR CAN
1x
32.000
ICE AMERICANO
+ ICE AMERICANO
NASI GORENG MAMAK 1x
60.000
ES KOPI SUSU AGREYA
1x
32.000
+ ES KOPI SUSU
AGREYA
NASI MANDHI AYAM
1x
65.000
2x
36.000
AIR MINERAL
PISANG GORENG
1x
35.000
MADU NIKMAT
Total Item
00
8
299.000
Total
Subtotal
299.000
Service Charge
8.970
PB1
30.797
Grand Total (Incl. Tax)
338.767
Payment Method`;
    const result = parseReceipt(text);
    expect(result.line_items?.length).toBeGreaterThanOrEqual(7);
    const descs = result.line_items?.map((i) => i.description) ?? [];
    expect(descs).toContain('SEKAR CAN');
    expect(descs).toContain('ICE AMERICANO');
    expect(descs).toContain('NASI GORENG MAMAK');
    expect(descs).toContain('ES KOPI SUSU AGREYA');
    expect(descs).toContain('NASI MANDHI AYAM');
    expect(descs).toContain('AIR MINERAL');
    const air = result.line_items?.find((i) => i.description === 'AIR MINERAL');
    expect(air?.amount).toBe(36_000);
    expect(air?.quantity).toBe(2);
    // Charges juga harus ke-detect
    expect(result.charges?.find((c) => c.type === 'tax')?.amount).toBe(30_797);
    expect(result.charges?.find((c) => c.type === 'service')?.amount).toBe(8_970);
    expect(result.total).toBe(338_767);
  });

  it('parses restaurant receipt with PB1 tax + service charge', () => {
    const text = `
Order Details
Item Name        Qty    Price
SEKAR CAN        1x     39.000
ICE AMERICANO    1x     32.000
NASI GORENG MAMAK 1x    60.000
ES KOPI SUSU AGREYA 1x  32.000
NASI MANDHI AYAM 1x     65.000
AIR MINERAL      2x     36.000
PISANG GORENG MADU 1x   35.000

Total Item       8     299.000

Total
Subtotal              299.000
Service Charge          8.970
PB1                    30.797
Grand Total           338.767
    `;
    const result = parseReceipt(text);
    expect(result.line_items?.length).toBeGreaterThanOrEqual(6);
    expect(result.charges?.find((c) => c.type === 'tax')?.amount).toBe(30_797);
    expect(result.charges?.find((c) => c.type === 'service')?.amount).toBe(8_970);
    expect(result.total).toBe(338_767);
  });
});
