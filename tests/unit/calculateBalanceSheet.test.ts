import { describe, it, expect, beforeEach } from 'vitest';
import { calculateBalanceSheet } from '@/lib/calculations';
import { ACC, legacyTxn, doubleEntryTxn, multiLineTxn, resetSeq } from './fixtures';

beforeEach(resetSeq);

/**
 * Helper: assert balance sheet equation Assets = Liabilities + Equity (within 1 cent).
 */
function expectBalanced(bs: ReturnType<typeof calculateBalanceSheet>) {
  const lhs = bs.assets.totalAssets;
  const rhs = bs.liabilities.totalLiabilities + bs.equity.totalEquity;
  expect(Math.abs(lhs - rhs)).toBeLessThan(0.01);
}

describe('calculateBalanceSheet', () => {
  it('returns balanced zero sheet for empty input + zero capital', () => {
    const bs = calculateBalanceSheet([], 0);
    expect(bs.assets.totalAssets).toBe(0);
    expect(bs.liabilities.totalLiabilities).toBe(0);
    expect(bs.equity.totalEquity).toBe(0);
    expectBalanced(bs);
  });

  it('fallback capital appears as cash + equity when no transactions exist', () => {
    const bs = calculateBalanceSheet([], 100_000_000);
    expect(bs.assets.cash).toBe(100_000_000);
    expect(bs.assets.totalAssets).toBe(100_000_000);
    expect(bs.equity.capital).toBe(100_000_000);
    expectBalanced(bs);
  });

  describe('double-entry transactions', () => {
    it('capital injection: Dr Kas / Cr Modal', () => {
      const bs = calculateBalanceSheet([
        doubleEntryTxn({ category: 'FIN', amount: 100_000_000, debit: ACC.kas, credit: ACC.equity }),
      ], 0);
      expect(bs.assets.cash).toBe(100_000_000);
      expect(bs.equity.capital).toBe(100_000_000);
      expect(bs.equity.retainedEarnings).toBe(0);
      expectBalanced(bs);
    });

    it('owner withdrawal: Dr Prive / Cr Kas — reduces retained earnings & cash', () => {
      const bs = calculateBalanceSheet([
        doubleEntryTxn({ category: 'FIN', amount: 100_000_000, debit: ACC.kas, credit: ACC.equity }),
        doubleEntryTxn({ category: 'FIN', amount: 5_000_000, debit: ACC.prive, credit: ACC.kas }),
      ], 0);
      expect(bs.assets.cash).toBe(95_000_000);
      expect(bs.equity.capital).toBe(100_000_000);
      expect(bs.equity.retainedEarnings).toBe(-5_000_000); // drawings folded into retained earnings
      expect(bs.equity.totalEquity).toBe(95_000_000); // 100M - 5M (no profit)
      expectBalanced(bs);
    });

    it('inventory purchase: cash → inventory, total assets unchanged', () => {
      const bs = calculateBalanceSheet([
        doubleEntryTxn({ category: 'FIN', amount: 50_000_000, debit: ACC.kas, credit: ACC.equity }),
        doubleEntryTxn({ category: 'VAR', amount: 10_000_000, debit: ACC.inventory, credit: ACC.kas }),
      ], 0);
      expect(bs.assets.cash).toBe(40_000_000);
      expect(bs.assets.inventory).toBe(10_000_000);
      expect(bs.assets.totalAssets).toBe(50_000_000);
      expectBalanced(bs);
    });

    it('revenue flows into retained earnings', () => {
      const bs = calculateBalanceSheet([
        doubleEntryTxn({ category: 'EARN', amount: 5_000_000, debit: ACC.kas, credit: ACC.revenue }),
      ], 0);
      expect(bs.assets.cash).toBe(5_000_000);
      expect(bs.equity.retainedEarnings).toBe(5_000_000);
      expectBalanced(bs);
    });

    it('expense reduces retained earnings', () => {
      const bs = calculateBalanceSheet([
        doubleEntryTxn({ category: 'FIN', amount: 10_000_000, debit: ACC.kas, credit: ACC.equity }),
        doubleEntryTxn({ category: 'OPEX', amount: 1_000_000, debit: ACC.opexExpense, credit: ACC.kas }),
      ], 0);
      expect(bs.assets.cash).toBe(9_000_000);
      expect(bs.equity.capital).toBe(10_000_000);
      expect(bs.equity.retainedEarnings).toBe(-1_000_000);
      expect(bs.equity.totalEquity).toBe(9_000_000);
      expectBalanced(bs);
    });

    it('loan received: Dr Kas / Cr Hutang — increases assets & liabilities', () => {
      const bs = calculateBalanceSheet([
        doubleEntryTxn({ category: 'FIN', amount: 50_000_000, debit: ACC.kas, credit: ACC.loan, name: 'Terima pinjaman bank' }),
      ], 0);
      expect(bs.assets.cash).toBe(50_000_000);
      expect(bs.liabilities.loans).toBe(50_000_000);
      expectBalanced(bs);
    });

    it('loan repayment reduces both cash and liability', () => {
      const bs = calculateBalanceSheet([
        doubleEntryTxn({ category: 'FIN', amount: 50_000_000, debit: ACC.kas, credit: ACC.loan }),
        doubleEntryTxn({ category: 'FIN', amount: 10_000_000, debit: ACC.loan, credit: ACC.kas }),
      ], 0);
      expect(bs.assets.cash).toBe(40_000_000);
      expect(bs.liabilities.loans).toBe(40_000_000);
      expectBalanced(bs);
    });

    it('fixed asset purchase classifies into fixedAssets bucket', () => {
      const bs = calculateBalanceSheet([
        doubleEntryTxn({ category: 'FIN', amount: 20_000_000, debit: ACC.kas, credit: ACC.equity }),
        doubleEntryTxn({ category: 'CAPEX', amount: 8_000_000, debit: ACC.fixedAsset, credit: ACC.kas }),
      ], 0);
      expect(bs.assets.cash).toBe(12_000_000);
      expect(bs.assets.fixedAssets).toBe(8_000_000);
      expect(bs.assets.totalAssets).toBe(20_000_000);
      expectBalanced(bs);
    });

    it('receivable classifies into receivables bucket', () => {
      const bs = calculateBalanceSheet([
        doubleEntryTxn({ category: 'EARN', amount: 3_000_000, debit: ACC.piutang, credit: ACC.revenue }),
      ], 0);
      expect(bs.assets.receivables).toBe(3_000_000);
      expect(bs.assets.cash).toBe(0);
      expectBalanced(bs);
    });
  });

  describe('multi-line journal entries', () => {
    it('compound entry with multiple debits and credits', () => {
      // Sale: cash + receivable, revenue + tax payable
      const bs = calculateBalanceSheet([
        multiLineTxn({
          category: 'FIN', amount: 100_000_000,
          lines: [
            { account: ACC.kas, debit: 100_000_000 },
            { account: ACC.equity, credit: 100_000_000 },
          ],
        }),
        multiLineTxn({
          category: 'EARN', amount: 10_000_000,
          lines: [
            { account: ACC.kas, debit: 5_000_000 },
            { account: ACC.piutang, debit: 5_000_000 },
            { account: ACC.revenue, credit: 10_000_000 },
          ],
        }),
      ], 0);
      expect(bs.assets.cash).toBe(105_000_000);
      expect(bs.assets.receivables).toBe(5_000_000);
      expect(bs.assets.totalAssets).toBe(110_000_000);
      expect(bs.equity.capital).toBe(100_000_000);
      expect(bs.equity.retainedEarnings).toBe(10_000_000);
      expectBalanced(bs);
    });
  });

  describe('legacy transactions', () => {
    it('legacy revenue + expense flows through retained earnings', () => {
      const bs = calculateBalanceSheet([
        legacyTxn({ category: 'EARN', amount: 10_000_000 }),
        legacyTxn({ category: 'OPEX', amount: 3_000_000 }),
      ], 50_000_000);
      // capital + (earn - opex) = 50 + 7 = 57 cash; capital eq 50 + retained 7
      expect(bs.equity.capital).toBe(50_000_000);
      expect(bs.equity.retainedEarnings).toBe(7_000_000);
      expectBalanced(bs);
    });

    it('legacy FIN with modal keyword adds to equity, not liabilities', () => {
      const bs = calculateBalanceSheet([
        legacyTxn({ category: 'FIN', amount: 25_000_000, name: 'Setoran modal' }),
      ], 0);
      // legacy fallback adds capital(0) + equityIn(25M) to equityCredit;
      // operating cash = 0, capex = 0, netFinCash = +25M → closingCash = 25M
      expect(bs.liabilities.loans).toBe(0);
      expect(bs.equity.capital).toBe(25_000_000);
      expectBalanced(bs);
    });

    it('legacy FIN with pinjaman keyword adds to liabilities', () => {
      const bs = calculateBalanceSheet([
        legacyTxn({ category: 'FIN', amount: 10_000_000, name: 'Terima pinjaman bank' }),
      ], 0);
      expect(bs.liabilities.loans).toBe(10_000_000);
      expectBalanced(bs);
    });
  });

  describe('balance sheet equation invariant', () => {
    it('remains balanced across mixed multi-line + double-entry + legacy', () => {
      const bs = calculateBalanceSheet([
        multiLineTxn({
          category: 'FIN', amount: 100_000_000,
          lines: [
            { account: ACC.kas, debit: 100_000_000 },
            { account: ACC.equity, credit: 100_000_000 },
          ],
        }),
        doubleEntryTxn({ category: 'CAPEX', amount: 20_000_000, debit: ACC.fixedAsset, credit: ACC.kas }),
        doubleEntryTxn({ category: 'VAR', amount: 5_000_000, debit: ACC.inventory, credit: ACC.kas }),
        doubleEntryTxn({ category: 'EARN', amount: 8_000_000, debit: ACC.kas, credit: ACC.revenue }),
        doubleEntryTxn({ category: 'VAR', amount: 3_000_000, debit: ACC.cogs, credit: ACC.inventory }),
        doubleEntryTxn({ category: 'OPEX', amount: 2_000_000, debit: ACC.opexExpense, credit: ACC.kas }),
        doubleEntryTxn({ category: 'FIN', amount: 50_000_000, debit: ACC.kas, credit: ACC.loan }),
        doubleEntryTxn({ category: 'FIN', amount: 1_000_000, debit: ACC.interest, credit: ACC.kas }),
      ], 0);
      expectBalanced(bs);
    });
  });
});
