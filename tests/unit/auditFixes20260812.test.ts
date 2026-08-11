/**
 * Regression tests untuk batch Medium/Low #1 audit 2026-06-11
 * (docs/AUDIT_2026-06-11.md → ACC-M3, ACC-L1;
 *  docs/ACCOUNTING_LOGIC.md Section 19 / Issue #28)
 *
 * ACC-M9 & ACC-M12 tidak diuji di sini: yang pertama murni wiring argumen di
 * React hook, yang kedua hidup di SQL (RPC `get_capex_by_business`, migrasi 128).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isClosingEntry,
  calculateFinancialSummary,
  extractIncomeStatementLineItems,
  groupTransactionsByMonth,
  calculateBalanceSheet,
} from '@/lib/calculations';
import { ACC, doubleEntryTxn, multiLineTxn, resetSeq } from './fixtures';

beforeEach(() => resetSeq());

const CLOSING_META = {
  entry_type: { id: 'closing_entry', label: 'Jurnal Penutup', description: 'Tutup buku periode' },
};

describe('ACC-M3 — jurnal penutup diabaikan di SELURUH jalur pelaporan', () => {
  const sale = () =>
    doubleEntryTxn({ amount: 10_000_000, category: 'EARN', debit: ACC.kas, credit: ACC.revenue });
  const expense = () =>
    doubleEntryTxn({ amount: 4_000_000, category: 'OPEX', debit: ACC.opexExpense, credit: ACC.kas });

  // Jurnal penutup: nol-kan pendapatan & beban ke ekuitas (laba ditahan).
  const closingSingle = () =>
    doubleEntryTxn({
      amount: 10_000_000,
      category: 'EARN',
      debit: ACC.revenue,
      credit: ACC.equity,
      meta: CLOSING_META,
    });
  const closingMultiLine = () =>
    multiLineTxn({
      amount: 10_000_000,
      category: 'EARN',
      lines: [
        { account: ACC.revenue, debit: 10_000_000 },
        { account: ACC.opexExpense, credit: 4_000_000 },
        { account: ACC.equity, credit: 6_000_000 },
      ],
      meta: CLOSING_META,
    });

  it('isClosingEntry mengenali penanda meta', () => {
    expect(isClosingEntry(closingSingle())).toBe(true);
    expect(isClosingEntry(sale())).toBe(false);
  });

  it('calculateFinancialSummary: closing entry single tidak menghapus revenue', () => {
    const withoutClosing = calculateFinancialSummary([sale(), expense()]);
    const withClosing = calculateFinancialSummary([sale(), expense(), closingSingle()]);
    expect(withClosing.totalEarn).toBe(withoutClosing.totalEarn);
    expect(withClosing.netProfit).toBe(6_000_000);
  });

  it('calculateFinancialSummary: closing entry MULTI-LINE juga diabaikan (inti ACC-M3)', () => {
    const withoutClosing = calculateFinancialSummary([sale(), expense()]);
    const withClosing = calculateFinancialSummary([sale(), expense(), closingMultiLine()]);
    expect(withClosing.totalEarn).toBe(withoutClosing.totalEarn);
    expect(withClosing.totalOpex).toBe(withoutClosing.totalOpex);
    expect(withClosing.netProfit).toBe(6_000_000);
  });

  it('extractIncomeStatementLineItems tidak menampilkan baris jurnal penutup', () => {
    const items = extractIncomeStatementLineItems([sale(), expense(), closingMultiLine()]);
    const revLine = items.revenue.find((l) => l.accountId === ACC.revenue.id);
    expect(revLine?.total).toBe(10_000_000);
  });

  it('groupTransactionsByMonth tidak mengurangkan closing entry dari bulan berjalan', () => {
    const months = groupTransactionsByMonth([sale(), expense(), closingMultiLine()]);
    expect(months).toHaveLength(1);
    expect(months[0].earn).toBe(10_000_000);
    expect(months[0].netProfit).toBe(6_000_000);
  });

  it('calculateBalanceSheet tetap mengabaikannya (perilaku lama tidak berubah)', () => {
    const withoutClosing = calculateBalanceSheet([sale(), expense()]);
    const withClosing = calculateBalanceSheet([sale(), expense(), closingMultiLine()]);
    expect(withClosing.assets.totalAssets).toBe(withoutClosing.assets.totalAssets);
    expect(withClosing.equity.totalEquity).toBe(withoutClosing.equity.totalEquity);
    expect(withClosing.equity.retainedEarnings).toBe(6_000_000);
  });
});

describe('ACC-L1 — groupTransactionsByMonth sortir kronologis, bukan alfabetis', () => {
  it('urut benar saat melewati batas tahun', () => {
    // Des 2025 → Jan 2026 → Agu 2026. Sortir by nama terlokalisasi akan
    // menghasilkan "Agu 2026" < "Des 2025" < "Jan 2026" (alfabetis).
    const txns = [
      doubleEntryTxn({ date: '2026-08-10', amount: 3_000_000, category: 'EARN', debit: ACC.kas, credit: ACC.revenue }),
      doubleEntryTxn({ date: '2025-12-05', amount: 1_000_000, category: 'EARN', debit: ACC.kas, credit: ACC.revenue }),
      doubleEntryTxn({ date: '2026-01-20', amount: 2_000_000, category: 'EARN', debit: ACC.kas, credit: ACC.revenue }),
    ];

    const months = groupTransactionsByMonth(txns);

    expect(months).toHaveLength(3);
    expect(months.map((m) => m.earn)).toEqual([1_000_000, 2_000_000, 3_000_000]);
  });
});
