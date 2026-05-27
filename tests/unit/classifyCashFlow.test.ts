import { describe, it, expect } from 'vitest';
import { __test__ } from '@/lib/calculations';
import { ACC, makeAccount } from './fixtures';

const { classifyCashFlow } = __test__;

describe('classifyCashFlow', () => {
  it('REVENUE → operating', () => {
    expect(classifyCashFlow(ACC.revenue)).toBe('operating');
  });

  it('EXPENSE → operating', () => {
    expect(classifyCashFlow(ACC.opexExpense)).toBe('operating');
    expect(classifyCashFlow(ACC.cogs)).toBe('operating');
    expect(classifyCashFlow(ACC.tax)).toBe('operating');
  });

  it('EQUITY → financing', () => {
    expect(classifyCashFlow(ACC.equity)).toBe('financing');
    expect(classifyCashFlow(ACC.prive)).toBe('financing');
  });

  describe('ASSET classification', () => {
    it('trade receivable (default_category=EARN) → operating', () => {
      expect(classifyCashFlow(ACC.piutang)).toBe('operating');
    });

    it('account with "receivable" in name → operating', () => {
      const acc = makeAccount({ code: '1301', name: 'Trade Receivable USD', type: 'ASSET' });
      expect(classifyCashFlow(acc)).toBe('operating');
    });

    it('account with "piutang usaha" in name → operating', () => {
      const acc = makeAccount({ code: '1302', name: 'Piutang Usaha Reseller', type: 'ASSET' });
      expect(classifyCashFlow(acc)).toBe('operating');
    });

    it('advance/talangan (default_category=FIN) → financing', () => {
      const acc = makeAccount({ code: '1350', name: 'Talangan Karyawan', type: 'ASSET', default_category: 'FIN' });
      expect(classifyCashFlow(acc)).toBe('financing');
    });

    it('account with "advance" in name → financing', () => {
      const acc = makeAccount({ code: '1351', name: 'Employee Advance', type: 'ASSET' });
      expect(classifyCashFlow(acc)).toBe('financing');
    });

    it('inventory (default_category=VAR) → investing', () => {
      expect(classifyCashFlow(ACC.inventory)).toBe('investing');
    });

    it('fixed asset (default_category=CAPEX) → investing', () => {
      expect(classifyCashFlow(ACC.fixedAsset)).toBe('investing');
    });
  });

  describe('LIABILITY classification', () => {
    it('trade payable (default_category=OPEX) → operating', () => {
      expect(classifyCashFlow(ACC.payable)).toBe('operating');
    });

    it('liability with "hutang usaha" in name → operating', () => {
      const acc = makeAccount({ code: '2201', name: 'Hutang Usaha Vendor', type: 'LIABILITY' });
      expect(classifyCashFlow(acc)).toBe('operating');
    });

    it('liability with "payable" in name → operating', () => {
      const acc = makeAccount({ code: '2202', name: 'Accounts Payable', type: 'LIABILITY' });
      expect(classifyCashFlow(acc)).toBe('operating');
    });

    it('liability with "accrued" in name → operating', () => {
      const acc = makeAccount({ code: '2203', name: 'Accrued Expenses', type: 'LIABILITY' });
      expect(classifyCashFlow(acc)).toBe('operating');
    });

    it('VAR payable → operating', () => {
      const acc = makeAccount({ code: '2204', name: 'Hutang Persediaan', type: 'LIABILITY', default_category: 'VAR' });
      expect(classifyCashFlow(acc)).toBe('operating');
    });

    it('TAX payable → operating', () => {
      const acc = makeAccount({ code: '2205', name: 'Hutang Pajak', type: 'LIABILITY', default_category: 'TAX' });
      expect(classifyCashFlow(acc)).toBe('operating');
    });

    it('bank loan (default_category=FIN) → financing', () => {
      expect(classifyCashFlow(ACC.loan)).toBe('financing');
    });

    it('liability without operating signals → financing', () => {
      const acc = makeAccount({ code: '2300', name: 'Long Term Debt', type: 'LIABILITY' });
      expect(classifyCashFlow(acc)).toBe('financing');
    });
  });

  // Regression: audit finding — custom account names with explicit flag override
  describe('flag-based classification (Migration 085)', () => {
    it('ASSET with is_trade_receivable=true → operating (even with unconventional name)', () => {
      const acc = makeAccount({
        code: '1390',
        name: 'Tagihan Pelanggan',
        type: 'ASSET',
        is_trade_receivable: true,
      });
      expect(classifyCashFlow(acc)).toBe('operating');
    });

    it('LIABILITY with is_operating_payable=true → operating (even with unconventional name)', () => {
      const acc = makeAccount({
        code: '2290',
        name: 'Outstanding Bills',
        type: 'LIABILITY',
        is_operating_payable: true,
      });
      expect(classifyCashFlow(acc)).toBe('operating');
    });

    it('ASSET without flag and without heuristic match → investing (audit edge case unresolved)', () => {
      // Before flag is set by user, "Tagihan Pelanggan" still misclassifies.
      // This confirms the toggle is the escape hatch.
      const acc = makeAccount({ code: '1391', name: 'Tagihan Pelanggan', type: 'ASSET' });
      expect(classifyCashFlow(acc)).toBe('investing');
    });

    it('LIABILITY without flag and without heuristic match → financing (audit edge case unresolved)', () => {
      const acc = makeAccount({ code: '2291', name: 'Outstanding Bills', type: 'LIABILITY' });
      expect(classifyCashFlow(acc)).toBe('financing');
    });
  });
});
