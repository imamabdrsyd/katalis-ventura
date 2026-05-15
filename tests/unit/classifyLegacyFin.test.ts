import { describe, it, expect } from 'vitest';
import { __test__ } from '@/lib/calculations';

const { classifyLegacyFin } = __test__;

describe('classifyLegacyFin', () => {
  describe('interest keywords', () => {
    it.each([
      ['Bayar bunga pinjaman', ''],
      ['', 'beban bunga bank'],
      ['Interest payment', ''],
      ['BUNGA KPR', 'cicilan bulan ini'],
    ])('classifies "%s" / "%s" as interest', (name, desc) => {
      expect(classifyLegacyFin(name, desc)).toBe('interest');
    });

    it('interest keyword wins over loan keyword (priority order)', () => {
      // both "bunga" and "pinjaman" present — interest checked first
      expect(classifyLegacyFin('Bunga pinjaman bank', '')).toBe('interest');
    });
  });

  describe('equity keywords', () => {
    it.each([
      ['Setoran modal awal', ''],
      ['Modal pemilik', 'investasi pemilik'],
      ['Injeksi modal investor', ''],
      ['', 'setoran tambahan'],
    ])('classifies "%s" / "%s" as equity', (name, desc) => {
      expect(classifyLegacyFin(name, desc)).toBe('equity');
    });
  });

  describe('owner withdrawal / liability_out', () => {
    it.each([
      ['Prive bulanan', ''],
      ['Dividen Q1', ''],
      ['Penarikan pemilik', ''],
      ['', 'pengeluaran pribadi pemilik'],
      ['Cicilan KPR', ''],
      ['Pelunasan hutang bank', ''],
      ['Bayar pinjaman', ''],
      ['Angsuran kredit', ''],
    ])('classifies "%s" / "%s" as liability_out', (name, desc) => {
      expect(classifyLegacyFin(name, desc)).toBe('liability_out');
    });
  });

  describe('loan received / liability_in', () => {
    it.each([
      ['Terima pinjaman bank', ''],
      ['Kredit usaha', ''],
      ['KPR baru', ''],
      ['Pinjaman dari investor', ''],
    ])('classifies "%s" / "%s" as liability_in', (name, desc) => {
      expect(classifyLegacyFin(name, desc)).toBe('liability_in');
    });

    it('does NOT classify "cicilan" as liability_in even though it contains no other keyword', () => {
      // "cicilan" goes through liability_out branch first
      expect(classifyLegacyFin('Cicilan', '')).toBe('liability_out');
    });

    it('KNOWN LIMITATION: "Pinjaman modal kerja" is misclassified as equity because "modal" precedes "pinjaman" in keyword order', () => {
      // Documents real heuristic ambiguity — equity branch fires before liability_in.
      // If business rule changes, flip this test along with classifyLegacyFin priority.
      expect(classifyLegacyFin('Pinjaman modal kerja', '')).toBe('equity');
    });
  });

  describe('unknown', () => {
    it.each([
      ['Transfer antar bank', ''],
      ['Biaya admin', ''],
      ['', ''],
    ])('classifies "%s" / "%s" as unknown', (name, desc) => {
      expect(classifyLegacyFin(name, desc)).toBe('unknown');
    });
  });

  describe('case insensitivity', () => {
    it('matches keywords regardless of case', () => {
      expect(classifyLegacyFin('BUNGA', '')).toBe('interest');
      expect(classifyLegacyFin('Modal', '')).toBe('equity');
      expect(classifyLegacyFin('CICILAN', '')).toBe('liability_out');
    });
  });
});
