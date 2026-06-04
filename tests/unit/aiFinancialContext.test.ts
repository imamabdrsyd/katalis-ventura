import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  computeSummary,
  monthlyIncomeStatement,
  buildFinancialContext,
} from '@/lib/ai/financialContext';
import { calculateFinancialSummary } from '@/lib/calculations';
import { ACC, doubleEntryTxn, resetSeq, makeAccount } from './fixtures';

// Depresiasi di-cap ke wall-clock (new Date()), jadi kita kunci "hari ini" ke
// 2026-06-04 supaya periode Mei 2026 sepenuhnya di masa lalu & deterministik.
beforeEach(() => {
  resetSeq();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-04T00:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

// Aset tetap depreciable: cost 12jt, 12 bulan, residu 0, perolehan 1 Jan 2026
// → depresiasi 1.000.000 / bulan
const equipment = makeAccount({
  code: '1500',
  name: 'Peralatan Studio',
  type: 'ASSET',
  default_category: 'CAPEX',
  useful_life_months: 12,
  residual_value: 0,
  acquisition_date: '2026-01-01',
});

const accounts = [equipment, ACC.kas, ACC.revenue, ACC.opexExpense];

function scenarioTxns() {
  return [
    // Beli aset 12jt (Dr Peralatan / Cr Kas) — Januari
    doubleEntryTxn({ date: '2026-01-05', category: 'CAPEX', amount: 12_000_000, debit: equipment, credit: ACC.kas }),
    // Revenue Mei 5jt (Dr Kas / Cr Pendapatan)
    doubleEntryTxn({ date: '2026-05-10', category: 'EARN', amount: 5_000_000, debit: ACC.kas, credit: ACC.revenue }),
    // OpEx Mei 1jt (Dr Beban / Cr Kas)
    doubleEntryTxn({ date: '2026-05-15', category: 'OPEX', amount: 1_000_000, debit: ACC.opexExpense, credit: ACC.kas }),
  ];
}

describe('computeSummary', () => {
  it('REGRESSION: netProfit dikurangi depresiasi periode (match Income Statement)', () => {
    const txns = scenarioTxns();
    const may = txns.filter((t) => t.date >= '2026-05-01' && t.date <= '2026-05-31');

    const summary = computeSummary(may, txns, accounts, '2026-05-01', '2026-05-31');

    expect(summary.totalEarn).toBe(5_000_000);
    expect(summary.totalOpex).toBe(1_000_000);
    expect(summary.totalDepreciation).toBe(1_000_000); // 1 bulan
    // netProfit = 5jt − 1jt OpEx − 1jt depresiasi = 3jt
    expect(summary.netProfit).toBe(3_000_000);
  });

  it('membuktikan bug lama: calculateFinancialSummary mentah TIDAK kurangi depresiasi', () => {
    const may = scenarioTxns().filter((t) => t.date >= '2026-05-01');
    const raw = calculateFinancialSummary(may);
    expect(raw.totalDepreciation).toBe(0);
    expect(raw.netProfit).toBe(4_000_000); // overstated 1jt vs computeSummary (3jt)
  });

  it('tanpa accounts → tidak bisa hitung depresiasi, kembalikan base summary', () => {
    const may = scenarioTxns().filter((t) => t.date >= '2026-05-01');
    const summary = computeSummary(may, may, [], '2026-05-01', '2026-05-31');
    expect(summary.totalDepreciation).toBe(0);
    expect(summary.netProfit).toBe(4_000_000);
  });
});

describe('monthlyIncomeStatement', () => {
  it('string kosong untuk bulan tanpa transaksi', () => {
    expect(monthlyIncomeStatement([], accounts, '2026-05')).toBe('');
  });

  it('baris bulanan mencantumkan depresiasi & laba bersih yang benar', () => {
    const txns = scenarioTxns();
    const row = monthlyIncomeStatement(txns, accounts, '2026-05');
    expect(row).toContain('Mei 2026');
    expect(row).toContain('Revenue Rp 5.000.000');
    expect(row).toContain('Depresiasi Rp 1.000.000');
    expect(row).toContain('Laba Bersih Rp 3.000.000');
  });
});

describe('buildFinancialContext', () => {
  it('kembalikan "belum ada data" saat transaksi kosong', () => {
    const ctx = buildFinancialContext('Toko A', 'food_and_beverage', [], [], new Date('2026-06-04'));
    expect(ctx).toContain('Belum ada data transaksi');
  });

  it('mengandung P&L bulanan + ringkasan all-time dengan depresiasi', () => {
    const txns = scenarioTxns();
    const ctx = buildFinancialContext('Hillside', 'accommodation', txns, accounts, new Date('2026-06-04'));
    expect(ctx).toContain('Hillside');
    expect(ctx).toContain('Mei 2026');
    expect(ctx).toContain('Depresiasi Rp 1.000.000');
    // All-time net profit juga sudah kurangi depresiasi (5jt − 1jt − 1jt = 3jt,
    // depresiasi all-time dari Jan–Jun = 5 bulan tapi periode Mei saja 1 bulan;
    // di sini cuma cek field ada & angka revenue benar)
    expect(ctx).toContain('Revenue Rp 5.000.000');
  });

  it('tidak membocorkan transaksi mentah berlebihan (output ringkas)', () => {
    const txns = scenarioTxns();
    const ctx = buildFinancialContext('Hillside', 'accommodation', txns, accounts, new Date('2026-06-04'));
    // Konteks harus < 4KB supaya hemat token
    expect(ctx.length).toBeLessThan(4096);
  });
});
