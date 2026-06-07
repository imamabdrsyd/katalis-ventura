import { describe, expect, it } from 'vitest';
import { needsBusinessInfo, needsReasoning } from '@/lib/ai/intent';

describe('needsReasoning', () => {
  it('pertanyaan analitik biasa → tidak butuh reasoning (Gemini dulu)', () => {
    expect(needsReasoning('Kategori beban terbesar apa?')).toBe(false);
    expect(needsReasoning('Berapa revenue bulan ini?')).toBe(false);
    expect(needsReasoning('Net margin saya berapa?')).toBe(false);
    expect(needsReasoning('Tren revenue 3 bulan terakhir gimana?')).toBe(false);
  });

  it('pertanyaan audit → butuh reasoning (R1 dulu)', () => {
    expect(needsReasoning('Tolong audit laporan keuangan saya')).toBe(true);
    expect(needsReasoning('Kenapa neraca saya tidak balance?')).toBe(true);
    expect(needsReasoning('Ada selisih di kas, coba periksa')).toBe(true);
    expect(needsReasoning('Apakah ada transaksi yang janggal?')).toBe(true);
  });

  it('pertanyaan proyeksi → butuh reasoning (R1 dulu)', () => {
    expect(needsReasoning('Proyeksikan laba bulan depan')).toBe(true);
    expect(needsReasoning('Bagaimana jika revenue naik 20%?')).toBe(true);
    expect(needsReasoning('Buat simulasi skenario pesimis')).toBe(true);
    expect(needsReasoning('Estimasi cash flow tahun depan')).toBe(true);
  });

  it('case-insensitive', () => {
    expect(needsReasoning('AUDIT semua transaksi')).toBe(true);
    expect(needsReasoning('FORECAST pendapatan')).toBe(true);
  });
});

describe('needsBusinessInfo', () => {
  it('mendeteksi pertanyaan creator, anggota, dan cap table bisnis', () => {
    expect(needsBusinessInfo('Siapa pemilik bisnis ini?')).toBe(true);
    expect(needsBusinessInfo('Bisnis ini punya siapa?')).toBe(true);
    expect(needsBusinessInfo('Siapa yang membuat bisnis ini?')).toBe(true);
    expect(needsBusinessInfo('Siapa saja anggota bisnis ini?')).toBe(true);
    expect(needsBusinessInfo('Tampilkan cap table dan modal disetor')).toBe(true);
  });

  it('tidak mengambil konteks bisnis untuk pertanyaan produk AXION atau transaksi biasa', () => {
    expect(needsBusinessInfo('Siapa pemilik AXION?')).toBe(false);
    expect(needsBusinessInfo('Berapa penarikan pemilik bulan ini?')).toBe(false);
    expect(needsBusinessInfo('Berapa revenue bulan ini?')).toBe(false);
  });

  it('case-insensitive', () => {
    expect(needsBusinessInfo('BUSINESS OWNER perusahaan ini siapa?')).toBe(true);
    expect(needsBusinessInfo('CAP TABLE bisnis ini bagaimana?')).toBe(true);
  });
});
