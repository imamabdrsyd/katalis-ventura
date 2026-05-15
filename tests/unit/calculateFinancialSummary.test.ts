import { describe, it, expect, beforeEach } from 'vitest';
import { calculateFinancialSummary } from '@/lib/calculations';
import { ACC, legacyTxn, doubleEntryTxn, multiLineTxn, resetSeq, makeAccount } from './fixtures';

beforeEach(resetSeq);

describe('calculateFinancialSummary', () => {
  it('returns zero summary for empty transaction list', () => {
    const s = calculateFinancialSummary([]);
    expect(s).toEqual({
      totalEarn: 0, totalOpex: 0, totalVar: 0, totalCapex: 0,
      totalTax: 0, totalFin: 0, totalInterest: 0, totalDepreciation: 0,
      netProfit: 0, grossProfit: 0,
    });
  });

  describe('legacy transactions (no debit/credit accounts)', () => {
    it('sums each category correctly', () => {
      const s = calculateFinancialSummary([
        legacyTxn({ category: 'EARN', amount: 100_000 }),
        legacyTxn({ category: 'EARN', amount: 50_000 }),
        legacyTxn({ category: 'OPEX', amount: 30_000 }),
        legacyTxn({ category: 'VAR', amount: 40_000 }),
        legacyTxn({ category: 'CAPEX', amount: 200_000 }),
        legacyTxn({ category: 'TAX', amount: 10_000 }),
        legacyTxn({ category: 'FIN', amount: 500_000, name: 'Modal awal' }),
      ]);
      expect(s.totalEarn).toBe(150_000);
      expect(s.totalOpex).toBe(30_000);
      expect(s.totalVar).toBe(40_000);
      expect(s.totalCapex).toBe(200_000);
      expect(s.totalTax).toBe(10_000);
      expect(s.totalFin).toBe(500_000);
      expect(s.totalInterest).toBe(0); // modal awal != bunga
    });

    it('legacy FIN with interest keyword counts as interest expense', () => {
      const s = calculateFinancialSummary([
        legacyTxn({ category: 'FIN', amount: 5_000, name: 'Bayar bunga pinjaman' }),
      ]);
      expect(s.totalFin).toBe(5_000);
      expect(s.totalInterest).toBe(5_000);
      // Interest reduces net profit
      expect(s.netProfit).toBe(-5_000);
    });

    it('legacy FIN without interest keyword does NOT count as interest', () => {
      const s = calculateFinancialSummary([
        legacyTxn({ category: 'FIN', amount: 100_000_000, name: 'Setoran modal pemilik' }),
      ]);
      expect(s.totalFin).toBe(100_000_000);
      expect(s.totalInterest).toBe(0);
      expect(s.netProfit).toBe(0);
    });
  });

  describe('grossProfit & netProfit formulas', () => {
    it('grossProfit = totalEarn - totalVar', () => {
      const s = calculateFinancialSummary([
        legacyTxn({ category: 'EARN', amount: 100 }),
        legacyTxn({ category: 'VAR', amount: 30 }),
      ]);
      expect(s.grossProfit).toBe(70);
    });

    it('netProfit = totalEarn - totalOpex - totalVar - totalTax - totalInterest (excludes totalFin/capex)', () => {
      const s = calculateFinancialSummary([
        legacyTxn({ category: 'EARN', amount: 1000 }),
        legacyTxn({ category: 'OPEX', amount: 200 }),
        legacyTxn({ category: 'VAR', amount: 100 }),
        legacyTxn({ category: 'TAX', amount: 50 }),
        legacyTxn({ category: 'CAPEX', amount: 500 }), // excluded
        legacyTxn({ category: 'FIN', amount: 25, name: 'bunga' }),
      ]);
      // 1000 - 200 - 100 - 50 - 25 = 625
      expect(s.netProfit).toBe(625);
    });
  });

  describe('double-entry transactions', () => {
    it('EARN with non-REVENUE credit (settlement) does NOT count as revenue', () => {
      // Dr Kas / Cr Piutang — pelunasan, bukan pengakuan revenue
      const s = calculateFinancialSummary([
        doubleEntryTxn({ category: 'EARN', amount: 5_000_000, debit: ACC.kas, credit: ACC.piutang }),
      ]);
      expect(s.totalEarn).toBe(0);
    });

    it('EARN with REVENUE credit recognizes revenue', () => {
      const s = calculateFinancialSummary([
        doubleEntryTxn({ category: 'EARN', amount: 5_000_000, debit: ACC.kas, credit: ACC.revenue }),
      ]);
      expect(s.totalEarn).toBe(5_000_000);
    });

    it('VAR with ASSET debit (inventory purchase) is NOT booked as COGS', () => {
      // Dr Persediaan / Cr Kas — beli stok, belum jadi HPP
      const s = calculateFinancialSummary([
        doubleEntryTxn({ category: 'VAR', amount: 1_000_000, debit: ACC.inventory, credit: ACC.kas }),
      ]);
      expect(s.totalVar).toBe(0);
    });

    it('VAR with EXPENSE debit (COGS account) is booked as COGS', () => {
      const s = calculateFinancialSummary([
        doubleEntryTxn({ category: 'VAR', amount: 800_000, debit: ACC.cogs, credit: ACC.inventory }),
      ]);
      expect(s.totalVar).toBe(800_000);
    });

    it('VAR with EXPENSE override to operating_expense reclassifies as OPEX', () => {
      const override = makeAccount({
        code: '5210', name: 'Beban Logistik', type: 'EXPENSE',
        default_category: 'VAR', income_statement_section: 'operating_expense',
      });
      const s = calculateFinancialSummary([
        doubleEntryTxn({ category: 'VAR', amount: 500_000, debit: override, credit: ACC.kas }),
      ]);
      expect(s.totalVar).toBe(0);
      expect(s.totalOpex).toBe(500_000);
    });

    it('OPEX with EXPENSE override to cost_of_revenue reclassifies as COGS', () => {
      const override = makeAccount({
        code: '5110', name: 'Beban Produksi', type: 'EXPENSE',
        default_category: 'OPEX', income_statement_section: 'cost_of_revenue',
      });
      const s = calculateFinancialSummary([
        doubleEntryTxn({ category: 'OPEX', amount: 300_000, debit: override, credit: ACC.kas }),
      ]);
      expect(s.totalVar).toBe(300_000);
      expect(s.totalOpex).toBe(0);
    });

    it('FIN with EXPENSE debit counts as interest (income statement)', () => {
      const s = calculateFinancialSummary([
        doubleEntryTxn({ category: 'FIN', amount: 100_000, debit: ACC.interest, credit: ACC.kas }),
      ]);
      expect(s.totalFin).toBe(100_000);
      expect(s.totalInterest).toBe(100_000);
      expect(s.netProfit).toBe(-100_000);
    });

    it('FIN touching EQUITY does NOT count as interest', () => {
      // Capital injection: Dr Kas / Cr Equity
      const s = calculateFinancialSummary([
        doubleEntryTxn({ category: 'FIN', amount: 50_000_000, debit: ACC.kas, credit: ACC.equity }),
      ]);
      expect(s.totalFin).toBe(50_000_000);
      expect(s.totalInterest).toBe(0);
      expect(s.netProfit).toBe(0);
    });

    it('FIN touching LIABILITY does NOT count as interest', () => {
      // Loan repayment: Dr Hutang / Cr Kas
      const s = calculateFinancialSummary([
        doubleEntryTxn({ category: 'FIN', amount: 5_000_000, debit: ACC.loan, credit: ACC.kas }),
      ]);
      expect(s.totalInterest).toBe(0);
    });
  });

  describe('multi-line journal entries', () => {
    it('aggregates revenue from credit lines and COGS+OPEX from debit lines', () => {
      // Compound entry: customer payment + revenue recognition + COGS
      const s = calculateFinancialSummary([
        multiLineTxn({
          category: 'EARN', amount: 1_000_000,
          lines: [
            { account: ACC.kas, debit: 1_000_000 },
            { account: ACC.revenue, credit: 1_000_000 },
          ],
        }),
        multiLineTxn({
          category: 'VAR', amount: 600_000,
          lines: [
            { account: ACC.cogs, debit: 600_000 },
            { account: ACC.inventory, credit: 600_000 },
          ],
        }),
      ]);
      expect(s.totalEarn).toBe(1_000_000);
      expect(s.totalVar).toBe(600_000);
      expect(s.grossProfit).toBe(400_000);
    });

    it('contra-revenue: debit to REVENUE reduces totalEarn', () => {
      const s = calculateFinancialSummary([
        multiLineTxn({
          category: 'EARN', amount: 50_000,
          lines: [
            { account: ACC.revenue, debit: 50_000 }, // sales return
            { account: ACC.kas, credit: 50_000 },
          ],
        }),
      ]);
      expect(s.totalEarn).toBe(-50_000);
    });

    it('FIN multi-line with EXPENSE debit is treated as interest (not OPEX)', () => {
      const s = calculateFinancialSummary([
        multiLineTxn({
          category: 'FIN', amount: 100_000,
          lines: [
            { account: ACC.interest, debit: 100_000 },
            { account: ACC.kas, credit: 100_000 },
          ],
        }),
      ]);
      expect(s.totalInterest).toBe(100_000);
      expect(s.totalOpex).toBe(0);
    });

    it('TAX expense in multi-line goes to totalTax not totalOpex', () => {
      const s = calculateFinancialSummary([
        multiLineTxn({
          category: 'TAX', amount: 25_000,
          lines: [
            { account: ACC.tax, debit: 25_000 },
            { account: ACC.kas, credit: 25_000 },
          ],
        }),
      ]);
      expect(s.totalTax).toBe(25_000);
      expect(s.totalOpex).toBe(0);
    });

    it('CAPEX multi-line accumulates totalCapex from amount field', () => {
      const s = calculateFinancialSummary([
        multiLineTxn({
          category: 'CAPEX', amount: 10_000_000,
          lines: [
            { account: ACC.fixedAsset, debit: 10_000_000 },
            { account: ACC.kas, credit: 10_000_000 },
          ],
        }),
      ]);
      expect(s.totalCapex).toBe(10_000_000);
    });
  });
});
