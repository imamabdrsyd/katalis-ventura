/**
 * Regression tests untuk batch fix audit 2026-06-11
 * (docs/AUDIT_2026-06-11.md → ACC-H1..H7, ACC-M1, ACC-M11;
 *  docs/ACCOUNTING_LOGIC.md Section 19 / Issue #27)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateFinancialSummary,
  groupTransactionsByMonth,
  extractIncomeStatementLineItems,
} from '@/lib/calculations';
import {
  calculateStraightLineDepreciation,
  calculateDepreciationSummary,
} from '@/lib/accounting/depreciation';
import {
  getPayableLineAmount,
  getPayableOutstandingAmount,
  buildPayableSettlementPrefill,
} from '@/lib/accounting/guidance/payableSettlement';
import { buildSettlementPrefill } from '@/lib/accounting/guidance/receivableSettlement';
import { ACC, doubleEntryTxn, multiLineTxn, resetSeq, makeAccount } from './fixtures';

beforeEach(() => resetSeq());

describe('ACC-H3 — retur penjualan (Dr Pendapatan / Cr Kas) = contra-revenue', () => {
  const sale = () =>
    doubleEntryTxn({ amount: 10_000_000, category: 'EARN', debit: ACC.kas, credit: ACC.revenue });
  const salesReturn = () =>
    doubleEntryTxn({ amount: 2_000_000, category: 'EARN', debit: ACC.revenue, credit: ACC.kas });

  it('calculateFinancialSummary mengurangi totalEarn', () => {
    const summary = calculateFinancialSummary([sale(), salesReturn()]);
    expect(summary.totalEarn).toBe(8_000_000);
    expect(summary.netProfit).toBe(8_000_000);
  });

  it('extractIncomeStatementLineItems mencatat baris negatif di akun pendapatan', () => {
    const items = extractIncomeStatementLineItems([sale(), salesReturn()]);
    const revLine = items.revenue.find((l) => l.accountId === ACC.revenue.id);
    expect(revLine?.total).toBe(8_000_000);
  });

  it('groupTransactionsByMonth mengurangi earn, bukan menambah', () => {
    const months = groupTransactionsByMonth([sale(), salesReturn()]);
    expect(months).toHaveLength(1);
    expect(months[0].earn).toBe(8_000_000);
  });
});

describe('ACC-H4 — reimbursement (Dr Kas / Cr Beban) = contra-expense', () => {
  const payBill = () =>
    doubleEntryTxn({ amount: 5_000_000, category: 'OPEX', debit: ACC.opexExpense, credit: ACC.kas });
  const refund = () =>
    doubleEntryTxn({ amount: 1_000_000, category: 'OPEX', debit: ACC.kas, credit: ACC.opexExpense });

  it('calculateFinancialSummary: totalOpex = 4jt, bukan 6jt', () => {
    const summary = calculateFinancialSummary([payBill(), refund()]);
    expect(summary.totalOpex).toBe(4_000_000);
  });

  it('extractIncomeStatementLineItems: baris negatif di akun beban yang dikredit', () => {
    const items = extractIncomeStatementLineItems([payBill(), refund()]);
    const opexLine = items.opex.find((l) => l.accountId === ACC.opexExpense.id);
    expect(opexLine?.total).toBe(4_000_000);
  });

  it('groupTransactionsByMonth mengikuti perilaku yang sama', () => {
    const months = groupTransactionsByMonth([payBill(), refund()]);
    expect(months[0].opex).toBe(4_000_000);
  });
});

describe('ACC-M1 — pelunasan beban/pajak akrual tidak double-count', () => {
  it('OPEX: akrual + pelunasan (Dr Hutang / Cr Kas) → beban dihitung sekali', () => {
    const accrual = doubleEntryTxn({
      amount: 3_000_000, category: 'OPEX', debit: ACC.opexExpense, credit: ACC.payable,
    });
    const settlement = doubleEntryTxn({
      amount: 3_000_000, category: 'OPEX', debit: ACC.payable, credit: ACC.kas,
    });
    const summary = calculateFinancialSummary([accrual, settlement]);
    expect(summary.totalOpex).toBe(3_000_000);
  });

  it('TAX: akrual + pelunasan → pajak dihitung sekali', () => {
    const accrual = doubleEntryTxn({
      amount: 1_000_000, category: 'TAX', debit: ACC.tax, credit: ACC.payable,
    });
    const settlement = doubleEntryTxn({
      amount: 1_000_000, category: 'TAX', debit: ACC.payable, credit: ACC.kas,
    });
    const summary = calculateFinancialSummary([accrual, settlement]);
    expect(summary.totalTax).toBe(1_000_000);
  });
});

describe('ACC-H5 — chart bulanan: pelunasan piutang bukan revenue', () => {
  it('penjualan kredit Mei + pelunasan Juni → revenue hanya di Mei', () => {
    const creditSale = doubleEntryTxn({
      date: '2026-05-10', amount: 10_000_000, category: 'EARN',
      debit: ACC.piutang, credit: ACC.revenue,
    });
    const settlement = doubleEntryTxn({
      date: '2026-06-05', amount: 10_000_000, category: 'EARN',
      debit: ACC.kas, credit: ACC.piutang,
    });
    const months = groupTransactionsByMonth([creditSale, settlement]);
    const totalEarn = months.reduce((s, m) => s + m.earn, 0);
    expect(totalEarn).toBe(10_000_000);
  });
});

describe('ACC-H6 — bunga FIN multi-line tidak double-count di netProfit bulanan', () => {
  it('baris bunga 1jt mengurangi netProfit 1jt (bukan 2jt)', () => {
    const loanPayment = multiLineTxn({
      amount: 3_000_000, category: 'FIN',
      lines: [
        { account: ACC.loan, debit: 2_000_000 },
        { account: ACC.interest, debit: 1_000_000 },
        { account: ACC.bank, credit: 3_000_000 },
      ],
    });
    const months = groupTransactionsByMonth([loanPayment]);
    expect(months[0].interest).toBe(1_000_000);
    expect(months[0].opex).toBe(0);
    expect(months[0].netProfit).toBe(-1_000_000);
  });
});

describe('ACC-H7 — konvensi bulan depresiasi identik antara Neraca & IS', () => {
  const asset = makeAccount({
    code: '1510', name: 'Mesin Produksi', type: 'ASSET', default_category: 'CAPEX',
    useful_life_months: 120, residual_value: 0, acquisition_date: '2025-01-10',
  });
  const cost = 120_000_000; // 1jt/bulan

  it('bulan akuisisi = bulan ke-1 (full-month)', () => {
    const result = calculateStraightLineDepreciation(
      cost, 0, 120, new Date('2025-01-10'), new Date('2025-01-31'),
    );
    expect(result.accumulatedDepreciation).toBe(1_000_000);
  });

  it('akumulasi setahun (Neraca) = beban periode setahun (IS)', () => {
    const reportDate = new Date('2025-12-31');
    const summary = calculateDepreciationSummary(
      [asset], () => cost, reportDate, new Date('2025-01-01'),
    );
    expect(summary.totalAccumulatedDepreciation).toBe(12_000_000);
    expect(summary.periodDepreciation).toBe(summary.totalAccumulatedDepreciation);
  });
});

describe('ACC-H1 — payable multi-line pakai net baris hutang, bukan gross header', () => {
  const purchase = () =>
    multiLineTxn({
      amount: 10_000_000, category: 'CAPEX',
      lines: [
        { account: ACC.fixedAsset, debit: 10_000_000 },
        { account: ACC.bank, credit: 3_000_000 },
        { account: ACC.payable, credit: 7_000_000 },
      ],
    });

  it('getPayableLineAmount = 7jt (bukan 10jt)', () => {
    expect(getPayableLineAmount(purchase())).toBe(7_000_000);
  });

  it('getPayableOutstandingAmount menghormati remaining_amount partial', () => {
    const tx = purchase();
    tx.meta = { remaining_amount: 2_500_000 };
    expect(getPayableOutstandingAmount(tx)).toBe(2_500_000);
  });

  it('buildPayableSettlementPrefill: amount = net hutang, debit = akun hutang', () => {
    const prefill = buildPayableSettlementPrefill(purchase(), Object.values(ACC));
    expect(prefill.amount).toBe(7_000_000);
    expect(prefill.debit_account_id).toBe(ACC.payable.id);
  });
});

describe('ACC-H2 — penjualan campuran: settlement memilih baris piutang, bukan ASSET pertama', () => {
  it('Dr Bank + Dr Piutang / Cr Pendapatan → kredit settlement = akun piutang, amount = net piutang', () => {
    const mixedSale = multiLineTxn({
      amount: 1_200_000, category: 'EARN',
      lines: [
        { account: ACC.bank, debit: 500_000 },
        { account: ACC.piutang, debit: 700_000 },
        { account: ACC.revenue, credit: 1_200_000 },
      ],
    });
    const prefill = buildSettlementPrefill(mixedSale, Object.values(ACC));
    expect(prefill.credit_account_id).toBe(ACC.piutang.id);
    expect(prefill.amount).toBe(700_000);
    expect(prefill.category).toBe('EARN');
  });
});
