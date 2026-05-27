import { describe, it, expect } from 'vitest';
import {
  isTradeReceivableAccount,
  isAdvanceReceivableAccount,
  isAnyReceivableAccount,
  isOperatingPayableAccount,
} from '@/lib/accounting/classification';
import { makeAccount } from './fixtures';

describe('classification helpers', () => {
  // ─────────────────── isTradeReceivableAccount ───────────────────

  describe('isTradeReceivableAccount', () => {
    it('returns false for null/undefined', () => {
      expect(isTradeReceivableAccount(null)).toBe(false);
      expect(isTradeReceivableAccount(undefined)).toBe(false);
    });

    it('returns false for non-ASSET accounts', () => {
      const liab = makeAccount({ code: '2200', name: 'Hutang Usaha', type: 'LIABILITY' });
      expect(isTradeReceivableAccount(liab)).toBe(false);
    });

    // Flag-first
    it('trusts is_trade_receivable=true even with unconventional name', () => {
      const acc = makeAccount({
        code: '1399',
        name: 'Tagihan Pelanggan',
        type: 'ASSET',
        is_trade_receivable: true,
      });
      expect(isTradeReceivableAccount(acc)).toBe(true);
    });

    it('trusts is_trade_receivable=true even when name has "advance"', () => {
      // Edge case: user explicitly flags an account named "Customer Advance Bills"
      // as trade receivable. The flag wins.
      const acc = makeAccount({
        code: '1398',
        name: 'Customer Advance Bills',
        type: 'ASSET',
        is_trade_receivable: true,
      });
      expect(isTradeReceivableAccount(acc)).toBe(true);
    });

    // Heuristic fallback
    it('matches default_category=EARN (without flag)', () => {
      const acc = makeAccount({
        code: '1300',
        name: 'Piutang Usaha',
        type: 'ASSET',
        default_category: 'EARN',
      });
      expect(isTradeReceivableAccount(acc)).toBe(true);
    });

    it('matches name containing "piutang usaha"', () => {
      const acc = makeAccount({ code: '1301', name: 'Piutang Usaha Reseller', type: 'ASSET' });
      expect(isTradeReceivableAccount(acc)).toBe(true);
    });

    it('matches name containing "trade receivable"', () => {
      const acc = makeAccount({ code: '1302', name: 'Trade Receivable USD', type: 'ASSET' });
      expect(isTradeReceivableAccount(acc)).toBe(true);
    });

    it('matches name containing "accounts receivable"', () => {
      const acc = makeAccount({ code: '1303', name: 'Accounts Receivable Old', type: 'ASSET' });
      expect(isTradeReceivableAccount(acc)).toBe(true);
    });

    // Negative heuristic
    it('excludes talangan (FIN ASSET)', () => {
      const acc = makeAccount({
        code: '1350',
        name: 'Talangan Karyawan',
        type: 'ASSET',
        default_category: 'FIN',
      });
      expect(isTradeReceivableAccount(acc)).toBe(false);
    });

    it('excludes advance (FIN ASSET)', () => {
      const acc = makeAccount({
        code: '1351',
        name: 'Employee Advance',
        type: 'ASSET',
        default_category: 'FIN',
      });
      expect(isTradeReceivableAccount(acc)).toBe(false);
    });

    it('excludes inventory (VAR ASSET)', () => {
      const acc = makeAccount({
        code: '1400',
        name: 'Persediaan',
        type: 'ASSET',
        default_category: 'VAR',
      });
      expect(isTradeReceivableAccount(acc)).toBe(false);
    });

    it('excludes fixed asset (CAPEX ASSET)', () => {
      const acc = makeAccount({
        code: '1500',
        name: 'Peralatan',
        type: 'ASSET',
        default_category: 'CAPEX',
      });
      expect(isTradeReceivableAccount(acc)).toBe(false);
    });

    it('handles audit edge case: "Tagihan Pelanggan" without flag → false (heuristic miss)', () => {
      // This is the case from the audit finding. Without the explicit flag,
      // heuristic can't detect it. User must toggle is_trade_receivable=true
      // in AccountForm to correctly classify it.
      const acc = makeAccount({ code: '1390', name: 'Tagihan Pelanggan', type: 'ASSET' });
      expect(isTradeReceivableAccount(acc)).toBe(false);
    });
  });

  // ─────────────────── isAdvanceReceivableAccount ───────────────────

  describe('isAdvanceReceivableAccount', () => {
    it('matches name containing "talangan"', () => {
      const acc = makeAccount({ code: '1350', name: 'Talangan Karyawan', type: 'ASSET' });
      expect(isAdvanceReceivableAccount(acc)).toBe(true);
    });

    it('matches name containing "advance"', () => {
      const acc = makeAccount({ code: '1351', name: 'Employee Advance', type: 'ASSET' });
      expect(isAdvanceReceivableAccount(acc)).toBe(true);
    });

    it('FIN-category ASSET with generic "Loan Receivable" name → advance (treated as financing)', () => {
      // "Loan Receivable" doesn't match the TRADE patterns ("piutang usaha",
      // "trade receivable", "account(s) receivable") — so a FIN-category ASSET
      // with this name falls into advance/financing bucket.
      const acc = makeAccount({
        code: '1360',
        name: 'Loan Receivable',
        type: 'ASSET',
        default_category: 'FIN',
      });
      expect(isAdvanceReceivableAccount(acc)).toBe(true);
    });

    it('FIN-category ASSET with trade-receivable name → NOT advance', () => {
      const acc = makeAccount({
        code: '1361',
        name: 'Trade Receivable Customer A',
        type: 'ASSET',
        default_category: 'FIN',
      });
      expect(isAdvanceReceivableAccount(acc)).toBe(false);
    });

    it('does not match if flagged as trade receivable', () => {
      const acc = makeAccount({
        code: '1352',
        name: 'Special Advance',
        type: 'ASSET',
        is_trade_receivable: true,
      });
      expect(isAdvanceReceivableAccount(acc)).toBe(false);
    });

    it('does not match plain trade receivable', () => {
      const acc = makeAccount({
        code: '1300',
        name: 'Piutang Usaha',
        type: 'ASSET',
        default_category: 'EARN',
      });
      expect(isAdvanceReceivableAccount(acc)).toBe(false);
    });
  });

  // ─────────────────── isAnyReceivableAccount ───────────────────

  describe('isAnyReceivableAccount', () => {
    it('matches trade receivable', () => {
      const acc = makeAccount({
        code: '1300',
        name: 'Piutang Usaha',
        type: 'ASSET',
        default_category: 'EARN',
      });
      expect(isAnyReceivableAccount(acc)).toBe(true);
    });

    it('matches advance receivable', () => {
      const acc = makeAccount({ code: '1350', name: 'Talangan Karyawan', type: 'ASSET' });
      expect(isAnyReceivableAccount(acc)).toBe(true);
    });

    it('does not match inventory or fixed asset', () => {
      const inv = makeAccount({
        code: '1400',
        name: 'Persediaan',
        type: 'ASSET',
        default_category: 'VAR',
      });
      expect(isAnyReceivableAccount(inv)).toBe(false);
    });
  });

  // ─────────────────── isOperatingPayableAccount ───────────────────

  describe('isOperatingPayableAccount', () => {
    it('returns false for null/undefined', () => {
      expect(isOperatingPayableAccount(null)).toBe(false);
      expect(isOperatingPayableAccount(undefined)).toBe(false);
    });

    it('returns false for non-LIABILITY accounts', () => {
      const asset = makeAccount({ code: '1100', name: 'Kas', type: 'ASSET' });
      expect(isOperatingPayableAccount(asset)).toBe(false);
    });

    // Flag-first
    it('trusts is_operating_payable=true even with unconventional name', () => {
      const acc = makeAccount({
        code: '2299',
        name: 'Outstanding Bills',
        type: 'LIABILITY',
        is_operating_payable: true,
      });
      expect(isOperatingPayableAccount(acc)).toBe(true);
    });

    // Heuristic fallback
    it('matches OPEX category', () => {
      const acc = makeAccount({
        code: '2200',
        name: 'Hutang Usaha',
        type: 'LIABILITY',
        default_category: 'OPEX',
      });
      expect(isOperatingPayableAccount(acc)).toBe(true);
    });

    it('matches VAR category', () => {
      const acc = makeAccount({
        code: '2204',
        name: 'Hutang Persediaan',
        type: 'LIABILITY',
        default_category: 'VAR',
      });
      expect(isOperatingPayableAccount(acc)).toBe(true);
    });

    it('matches TAX category', () => {
      const acc = makeAccount({
        code: '2205',
        name: 'Hutang Pajak',
        type: 'LIABILITY',
        default_category: 'TAX',
      });
      expect(isOperatingPayableAccount(acc)).toBe(true);
    });

    it('matches name containing "hutang usaha"', () => {
      const acc = makeAccount({ code: '2201', name: 'Hutang Usaha Vendor', type: 'LIABILITY' });
      expect(isOperatingPayableAccount(acc)).toBe(true);
    });

    it('matches name containing "accounts payable"', () => {
      const acc = makeAccount({ code: '2202', name: 'Accounts Payable', type: 'LIABILITY' });
      expect(isOperatingPayableAccount(acc)).toBe(true);
    });

    it('matches name containing "accrued"', () => {
      const acc = makeAccount({ code: '2203', name: 'Accrued Expenses', type: 'LIABILITY' });
      expect(isOperatingPayableAccount(acc)).toBe(true);
    });

    // Negative heuristic
    it('excludes bank loan (FIN with "pinjaman")', () => {
      const acc = makeAccount({
        code: '2100',
        name: 'Pinjaman Bank BCA',
        type: 'LIABILITY',
        default_category: 'FIN',
      });
      expect(isOperatingPayableAccount(acc)).toBe(false);
    });

    it('excludes bank loan (FIN with "loan")', () => {
      const acc = makeAccount({
        code: '2101',
        name: 'Bank Loan',
        type: 'LIABILITY',
        default_category: 'FIN',
      });
      expect(isOperatingPayableAccount(acc)).toBe(false);
    });

    it('excludes plain long-term debt without operating signals', () => {
      const acc = makeAccount({ code: '2300', name: 'Long Term Debt', type: 'LIABILITY' });
      expect(isOperatingPayableAccount(acc)).toBe(false);
    });

    it('handles audit edge case: "Outstanding Bills" without flag → false (heuristic miss)', () => {
      // Audit finding edge case: user creates "Outstanding Bills" without
      // setting default_category. Heuristic can't detect it. User must toggle
      // is_operating_payable=true in AccountForm.
      const acc = makeAccount({ code: '2290', name: 'Outstanding Bills', type: 'LIABILITY' });
      expect(isOperatingPayableAccount(acc)).toBe(false);
    });
  });
});
