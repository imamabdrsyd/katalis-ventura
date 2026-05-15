import { describe, it, expect, beforeEach } from 'vitest';
import { calculateCashFlow } from '@/lib/calculations';
import { ACC, legacyTxn, doubleEntryTxn, multiLineTxn, resetSeq } from './fixtures';

beforeEach(resetSeq);

describe('calculateCashFlow', () => {
  it('returns zero buckets for empty input', () => {
    const cf = calculateCashFlow([], 0);
    expect(cf.operating).toBe(0);
    expect(cf.investing).toBe(0);
    expect(cf.financing).toBe(0);
    expect(cf.netCashFlow).toBe(0);
    expect(cf.openingBalance).toBe(0);
    expect(cf.closingBalance).toBe(0);
  });

  it('uses capital as opening balance when no transactions provided', () => {
    const cf = calculateCashFlow([], 25_000_000);
    expect(cf.openingBalance).toBe(25_000_000);
    expect(cf.closingBalance).toBe(25_000_000);
  });

  describe('double-entry classification', () => {
    it('cash sale → operating inflow', () => {
      const cf = calculateCashFlow([
        doubleEntryTxn({ category: 'EARN', amount: 5_000_000, debit: ACC.kas, credit: ACC.revenue }),
      ]);
      expect(cf.operating).toBe(5_000_000);
      expect(cf.operatingTransactions).toHaveLength(1);
      expect(cf.operatingTransactions[0].amount).toBe(5_000_000);
    });

    it('cash payment to vendor (expense) → operating outflow', () => {
      const cf = calculateCashFlow([
        doubleEntryTxn({ category: 'OPEX', amount: 1_000_000, debit: ACC.opexExpense, credit: ACC.kas }),
      ]);
      expect(cf.operating).toBe(-1_000_000);
    });

    it('fixed asset purchase → investing outflow', () => {
      const cf = calculateCashFlow([
        doubleEntryTxn({ category: 'CAPEX', amount: 10_000_000, debit: ACC.fixedAsset, credit: ACC.kas }),
      ]);
      expect(cf.investing).toBe(-10_000_000);
      expect(cf.operating).toBe(0);
    });

    it('inventory purchase → investing outflow (per classifier rules)', () => {
      const cf = calculateCashFlow([
        doubleEntryTxn({ category: 'VAR', amount: 2_000_000, debit: ACC.inventory, credit: ACC.kas }),
      ]);
      expect(cf.investing).toBe(-2_000_000);
    });

    it('capital injection → financing inflow', () => {
      const cf = calculateCashFlow([
        doubleEntryTxn({ category: 'FIN', amount: 100_000_000, debit: ACC.kas, credit: ACC.equity }),
      ]);
      expect(cf.financing).toBe(100_000_000);
    });

    it('loan received → financing inflow', () => {
      const cf = calculateCashFlow([
        doubleEntryTxn({ category: 'FIN', amount: 50_000_000, debit: ACC.kas, credit: ACC.loan }),
      ]);
      expect(cf.financing).toBe(50_000_000);
    });

    it('receivable settlement (Dr Kas / Cr Piutang) → operating inflow', () => {
      const cf = calculateCashFlow([
        doubleEntryTxn({ category: 'EARN', amount: 3_000_000, debit: ACC.kas, credit: ACC.piutang }),
      ]);
      expect(cf.operating).toBe(3_000_000);
    });

    it('payable settlement (Dr Hutang Usaha / Cr Kas) → operating outflow', () => {
      const cf = calculateCashFlow([
        doubleEntryTxn({ category: 'OPEX', amount: 2_000_000, debit: ACC.payable, credit: ACC.kas }),
      ]);
      expect(cf.operating).toBe(-2_000_000);
    });

    it('bank-to-bank transfer (both cash) → no cash flow impact', () => {
      const cf = calculateCashFlow([
        doubleEntryTxn({ category: 'FIN', amount: 5_000_000, debit: ACC.bank, credit: ACC.kas }),
      ]);
      expect(cf.operating).toBe(0);
      expect(cf.investing).toBe(0);
      expect(cf.financing).toBe(0);
    });

    it('non-cash transaction (no kas/bank) → skipped', () => {
      // Dr Piutang / Cr Pendapatan — credit sale, no cash movement
      const cf = calculateCashFlow([
        doubleEntryTxn({ category: 'EARN', amount: 3_000_000, debit: ACC.piutang, credit: ACC.revenue }),
      ]);
      expect(cf.netCashFlow).toBe(0);
    });
  });

  describe('multi-line classification', () => {
    it('uses transaction.category to bucket, net cash movement as amount', () => {
      // Mixed receipt: 60% cash, 40% credit; revenue recognized fully
      const cf = calculateCashFlow([
        multiLineTxn({
          category: 'EARN', amount: 10_000_000,
          lines: [
            { account: ACC.kas, debit: 6_000_000 },
            { account: ACC.piutang, debit: 4_000_000 },
            { account: ACC.revenue, credit: 10_000_000 },
          ],
        }),
      ]);
      // net cash = 6M debit (no credit to cash) → operating bucket from EARN
      expect(cf.operating).toBe(6_000_000);
      expect(cf.investing).toBe(0);
    });

    it('accrual entry (no cash line) is skipped', () => {
      const cf = calculateCashFlow([
        multiLineTxn({
          category: 'OPEX', amount: 500_000,
          lines: [
            { account: ACC.opexExpense, debit: 500_000 },
            { account: ACC.payable, credit: 500_000 },
          ],
        }),
      ]);
      expect(cf.netCashFlow).toBe(0);
    });
  });

  describe('legacy classification', () => {
    it('EARN → operating in, OPEX → operating out, CAPEX → investing, FIN → financing', () => {
      const cf = calculateCashFlow([
        legacyTxn({ category: 'EARN', amount: 5_000_000 }),
        legacyTxn({ category: 'OPEX', amount: 1_000_000 }),
        legacyTxn({ category: 'CAPEX', amount: 3_000_000 }),
        legacyTxn({ category: 'FIN', amount: 10_000_000, name: 'Setoran modal' }),
      ]);
      expect(cf.operating).toBe(4_000_000);
      expect(cf.investing).toBe(-3_000_000);
      expect(cf.financing).toBe(10_000_000);
    });
  });

  describe('opening balance', () => {
    it('computes from pre-period transactions when allTransactions + startDate given', () => {
      const all = [
        doubleEntryTxn({ date: '2026-01-15', category: 'FIN', amount: 100_000_000, debit: ACC.kas, credit: ACC.equity }),
        doubleEntryTxn({ date: '2026-01-20', category: 'OPEX', amount: 5_000_000, debit: ACC.opexExpense, credit: ACC.kas }),
      ];
      const period = [
        doubleEntryTxn({ date: '2026-02-10', category: 'EARN', amount: 8_000_000, debit: ACC.kas, credit: ACC.revenue }),
      ];
      const cf = calculateCashFlow(period, 0, [...all, ...period], '2026-02-01');
      expect(cf.openingBalance).toBe(95_000_000);
      expect(cf.operating).toBe(8_000_000);
      expect(cf.closingBalance).toBe(103_000_000);
    });

    it('falls back to capital when no pre-period transactions exist', () => {
      const period = [
        doubleEntryTxn({ date: '2026-02-10', category: 'EARN', amount: 1_000_000, debit: ACC.kas, credit: ACC.revenue }),
      ];
      const cf = calculateCashFlow(period, 50_000_000, period, '2026-02-01');
      expect(cf.openingBalance).toBe(50_000_000);
    });
  });

  describe('closing balance invariant', () => {
    it('closingBalance = openingBalance + netCashFlow', () => {
      const txns = [
        doubleEntryTxn({ category: 'FIN', amount: 50_000_000, debit: ACC.kas, credit: ACC.equity }),
        doubleEntryTxn({ category: 'CAPEX', amount: 10_000_000, debit: ACC.fixedAsset, credit: ACC.kas }),
        doubleEntryTxn({ category: 'EARN', amount: 5_000_000, debit: ACC.kas, credit: ACC.revenue }),
        doubleEntryTxn({ category: 'OPEX', amount: 1_000_000, debit: ACC.opexExpense, credit: ACC.kas }),
      ];
      const cf = calculateCashFlow(txns, 0);
      expect(cf.netCashFlow).toBe(cf.operating + cf.investing + cf.financing);
      expect(cf.closingBalance).toBe(cf.openingBalance + cf.netCashFlow);
    });
  });
});
