import { describe, it, expect, beforeEach } from 'vitest';
import { calculateStatementOfChangesInEquity } from '@/lib/calculations';
import { ACC, makeAccount, doubleEntryTxn, multiLineTxn, resetSeq } from './fixtures';

beforeEach(resetSeq);

// Hillside Studio scenario: dua pemilik (Papah dominan modal, Imam kecil),
// tapi hak atas laba disepakati 50:50 lewat profit_share_pct.
const PAPAH = makeAccount({ code: '3100', name: 'Papah', type: 'EQUITY', is_stock: true, profit_share_pct: 50 });
const IMAM = makeAccount({ code: '3200', name: 'Imam', type: 'EQUITY', is_stock: true, profit_share_pct: 50 });
const DIV_PAPAH = makeAccount({ code: '3300', name: 'Dividen Papah', type: 'EQUITY', is_dividend: true, owner_stock_account_id: PAPAH.id });
const DIV_IMAM = makeAccount({ code: '3400', name: 'Dividen Imam', type: 'EQUITY', is_dividend: true, owner_stock_account_id: IMAM.id });
const DIVIDEND_PAYABLE = makeAccount({ code: '2300', name: 'Hutang Dividen', type: 'LIABILITY', is_dividend_payable: true });

const ACCOUNTS = [ACC.kas, ACC.bank, ACC.revenue, ACC.opexExpense, DIVIDEND_PAYABLE, PAPAH, IMAM, DIV_PAPAH, DIV_IMAM];

const Y = '2026';
const periodStart = `${Y}-01-01`;
const periodEnd = `${Y}-12-31`;

describe('calculateStatementOfChangesInEquity', () => {
  it('lists registered stock owners with zero balances when no transactions', () => {
    // Pemilik dgn akun is_stock tetap muncul (hak laba terdefinisi) meski belum ada mutasi.
    const sce = calculateStatementOfChangesInEquity([], periodStart, periodEnd, 0, ACCOUNTS);
    expect(sce.owners).toHaveLength(2);
    expect(sce.owners.every((o) => o.capitalClosing === 0)).toBe(true);
    expect(sce.netIncome).toBe(0);
    expect(sce.totalEquityClosing).toBe(0);
    expect(sce.isReconciled).toBe(true);
  });

  it('returns no owners when no accounts provided', () => {
    const sce = calculateStatementOfChangesInEquity([], periodStart, periodEnd, 0);
    expect(sce.owners).toHaveLength(0);
    expect(sce.isReconciled).toBe(true);
  });

  it('opening + additions - withdrawals = closing per owner', () => {
    const txns = [
      // Modal awal sebelum periode (jadi saldo awal)
      doubleEntryTxn({ category: 'FIN', amount: 100_000_000, debit: ACC.kas, credit: PAPAH, date: '2025-12-01' }),
      // Penambahan modal dalam periode
      doubleEntryTxn({ category: 'FIN', amount: 50_000_000, debit: ACC.kas, credit: PAPAH, date: '2026-03-10' }),
      doubleEntryTxn({ category: 'FIN', amount: 10_000_000, debit: ACC.kas, credit: IMAM, date: '2026-04-01' }),
    ];
    const sce = calculateStatementOfChangesInEquity(txns, periodStart, periodEnd, 0, ACCOUNTS);

    const papah = sce.owners.find((o) => o.stockAccountId === PAPAH.id)!;
    expect(papah.capitalOpening).toBe(100_000_000);
    expect(papah.capitalAdditions).toBe(50_000_000);
    expect(papah.capitalWithdrawals).toBe(0);
    expect(papah.capitalClosing).toBe(150_000_000);

    const imam = sce.owners.find((o) => o.stockAccountId === IMAM.id)!;
    expect(imam.capitalOpening).toBe(0);
    expect(imam.capitalAdditions).toBe(10_000_000);
    expect(imam.capitalClosing).toBe(10_000_000);
  });

  it('retainedOpening + netIncome - dividends = retainedClosing', () => {
    const txns = [
      doubleEntryTxn({ category: 'FIN', amount: 100_000_000, debit: ACC.kas, credit: PAPAH, date: '2025-12-01' }),
      // Laba periode: revenue 20jt, opex 8jt → net income 12jt
      doubleEntryTxn({ category: 'EARN', amount: 20_000_000, debit: ACC.kas, credit: ACC.revenue, date: '2026-05-01' }),
      doubleEntryTxn({ category: 'OPEX', amount: 8_000_000, debit: ACC.opexExpense, credit: ACC.kas, date: '2026-06-01' }),
      // Dividen 50:50 dari sebagian laba: 3jt masing-masing
      doubleEntryTxn({ category: 'FIN', amount: 3_000_000, debit: DIV_PAPAH, credit: ACC.kas, date: '2026-07-01' }),
      doubleEntryTxn({ category: 'FIN', amount: 3_000_000, debit: DIV_IMAM, credit: ACC.kas, date: '2026-07-01' }),
    ];
    const sce = calculateStatementOfChangesInEquity(txns, periodStart, periodEnd, 0, ACCOUNTS);

    expect(sce.retainedOpening).toBe(0);
    expect(sce.netIncome).toBe(12_000_000);
    expect(sce.dividendsDeclared).toBe(6_000_000);
    // RE closing = netIncome - dividends kumulatif (PSAK: dividen mengurangi RE)
    expect(sce.retainedClosing).toBe(6_000_000);
  });

  it('entitled dividend = profit_share_pct × netIncome (50:50)', () => {
    const txns = [
      doubleEntryTxn({ category: 'FIN', amount: 100_000_000, debit: ACC.kas, credit: PAPAH, date: '2025-12-01' }),
      doubleEntryTxn({ category: 'EARN', amount: 30_000_000, debit: ACC.kas, credit: ACC.revenue, date: '2026-05-01' }),
      doubleEntryTxn({ category: 'OPEX', amount: 10_000_000, debit: ACC.opexExpense, credit: ACC.kas, date: '2026-06-01' }),
      // Aktual: hanya Papah ambil dividen 5jt, Imam belum
      doubleEntryTxn({ category: 'FIN', amount: 5_000_000, debit: DIV_PAPAH, credit: ACC.kas, date: '2026-08-01' }),
    ];
    const sce = calculateStatementOfChangesInEquity(txns, periodStart, periodEnd, 0, ACCOUNTS);

    expect(sce.netIncome).toBe(20_000_000);

    const papah = sce.dividendReconciliation.find((r) => r.stockAccountId === PAPAH.id)!;
    expect(papah.entitled).toBe(10_000_000); // 50% × 20jt
    expect(papah.actual).toBe(5_000_000);
    expect(papah.variance).toBe(5_000_000); // belum dibagikan penuh

    const imam = sce.dividendReconciliation.find((r) => r.stockAccountId === IMAM.id)!;
    expect(imam.entitled).toBe(10_000_000);
    expect(imam.actual).toBe(0);
    expect(imam.variance).toBe(10_000_000);
  });

  it('tracks declared dividends that are still payable separately from settled cash dividends', () => {
    const txns = [
      doubleEntryTxn({ category: 'EARN', amount: 20_000_000, debit: ACC.kas, credit: ACC.revenue, date: '2026-05-01' }),
      // Papah: declared to Hutang Dividen and still outstanding.
      doubleEntryTxn({ category: 'FIN', amount: 10_000_000, debit: DIV_PAPAH, credit: DIVIDEND_PAYABLE, date: '2026-06-01' }),
      // Imam: direct cashout, no payable outstanding.
      doubleEntryTxn({ category: 'FIN', amount: 10_000_000, debit: DIV_IMAM, credit: ACC.kas, date: '2026-06-01' }),
    ];
    const sce = calculateStatementOfChangesInEquity(txns, periodStart, periodEnd, 0, ACCOUNTS);

    const papah = sce.dividendReconciliation.find((r) => r.stockAccountId === PAPAH.id)!;
    expect(papah.entitled).toBe(10_000_000);
    expect(papah.actual).toBe(10_000_000);
    expect(papah.variance).toBe(0);
    expect(papah.declaredOutstanding).toBe(10_000_000);

    const imam = sce.dividendReconciliation.find((r) => r.stockAccountId === IMAM.id)!;
    expect(imam.entitled).toBe(10_000_000);
    expect(imam.actual).toBe(10_000_000);
    expect(imam.variance).toBe(0);
    expect(imam.declaredOutstanding).toBe(0);
  });

  it('treats fully settled dividend declarations as no longer outstanding', () => {
    const txns = [
      doubleEntryTxn({ category: 'EARN', amount: 20_000_000, debit: ACC.kas, credit: ACC.revenue, date: '2026-05-01' }),
      doubleEntryTxn({
        category: 'FIN',
        amount: 10_000_000,
        debit: DIV_PAPAH,
        credit: DIVIDEND_PAYABLE,
        date: '2026-06-01',
        meta: { settled_by_transaction_id: 'txn-settlement' },
      }),
      doubleEntryTxn({
        category: 'FIN',
        amount: 10_000_000,
        debit: DIVIDEND_PAYABLE,
        credit: ACC.kas,
        date: '2026-06-15',
        meta: { settlement_of_transaction_id: 'txn-2' },
      }),
    ];
    const sce = calculateStatementOfChangesInEquity(txns, periodStart, periodEnd, 0, ACCOUNTS);

    const papah = sce.dividendReconciliation.find((r) => r.stockAccountId === PAPAH.id)!;
    expect(papah.declaredOutstanding).toBe(0);
  });

  it('falls back to capital % when profit_share_pct is null', () => {
    const papahNoShare = makeAccount({ code: '3100', name: 'Papah', type: 'EQUITY', is_stock: true });
    const imamNoShare = makeAccount({ code: '3200', name: 'Imam', type: 'EQUITY', is_stock: true });
    const accs = [ACC.kas, ACC.revenue, papahNoShare, imamNoShare];
    const txns = [
      doubleEntryTxn({ category: 'FIN', amount: 75_000_000, debit: ACC.kas, credit: papahNoShare, date: '2025-12-01' }),
      doubleEntryTxn({ category: 'FIN', amount: 25_000_000, debit: ACC.kas, credit: imamNoShare, date: '2025-12-01' }),
    ];
    const sce = calculateStatementOfChangesInEquity(txns, periodStart, periodEnd, 0, accs);

    const papah = sce.owners.find((o) => o.stockAccountId === papahNoShare.id)!;
    const imam = sce.owners.find((o) => o.stockAccountId === imamNoShare.id)!;
    expect(papah.profitShareIsExplicit).toBe(false);
    expect(papah.profitSharePct).toBeCloseTo(75, 5); // 75jt / 100jt
    expect(imam.profitSharePct).toBeCloseTo(25, 5);
  });

  it('works with multi-line journal (cicilan: pokok + ujrah dibayar pemilik)', () => {
    const txns = [
      doubleEntryTxn({ category: 'FIN', amount: 100_000_000, debit: ACC.kas, credit: PAPAH, date: '2025-12-01' }),
      // Multi-line: Dr Loans + Dr Beban, Cr Modal Papah (Papah bayarin cicilan)
      multiLineTxn({
        category: 'FIN',
        amount: 3_931_520,
        date: '2026-05-25',
        lines: [
          { account: ACC.loan, debit: 2_605_134 },
          { account: ACC.opexExpense, debit: 1_326_386 },
          { account: PAPAH, credit: 3_931_520 },
        ],
      }),
    ];
    const sce = calculateStatementOfChangesInEquity(txns, periodStart, periodEnd, 0, ACCOUNTS);
    const papah = sce.owners.find((o) => o.stockAccountId === PAPAH.id)!;
    // Modal Papah bertambah 3.931.520 dari pembayaran cicilan
    expect(papah.capitalAdditions).toBe(3_931_520);
    expect(papah.capitalClosing).toBe(103_931_520);
    // Beban ujrah mengurangi laba → netIncome negatif sebesar ujrah
    expect(sce.netIncome).toBe(-1_326_386);
  });

  it('SCE closing equity ties out to balance sheet equity (isReconciled)', () => {
    const txns = [
      doubleEntryTxn({ category: 'FIN', amount: 100_000_000, debit: ACC.kas, credit: PAPAH, date: '2025-12-01' }),
      doubleEntryTxn({ category: 'FIN', amount: 5_000_000, debit: ACC.kas, credit: IMAM, date: '2026-02-01' }),
      doubleEntryTxn({ category: 'EARN', amount: 15_000_000, debit: ACC.kas, credit: ACC.revenue, date: '2026-05-01' }),
      doubleEntryTxn({ category: 'OPEX', amount: 4_000_000, debit: ACC.opexExpense, credit: ACC.kas, date: '2026-06-01' }),
      doubleEntryTxn({ category: 'FIN', amount: 2_000_000, debit: DIV_PAPAH, credit: ACC.kas, date: '2026-07-01' }),
    ];
    const sce = calculateStatementOfChangesInEquity(txns, periodStart, periodEnd, 0, ACCOUNTS);
    expect(sce.isReconciled).toBe(true);
  });

  it('ties out when an owner withdraws CAPITAL from a stock account (tarik modal)', () => {
    // Regression Hillside Studio: Dr Modal Papah (is_stock) / Cr Bank "Tarik modal".
    // Sebelum fix, penarikan modal dikurangi DUA kali (kolom Capital + retained earnings
    // via Balance Sheet) sehingga isReconciled=false dan netIncome tercemar. Setelah fix,
    // tarik modal hanya mengurangi Capital pemilik; RE = laba operasi murni.
    const txns = [
      doubleEntryTxn({ category: 'FIN', amount: 100_000_000, debit: ACC.kas, credit: PAPAH, date: '2025-12-01' }),
      doubleEntryTxn({ category: 'EARN', amount: 15_000_000, debit: ACC.kas, credit: ACC.revenue, date: '2026-05-01' }),
      // Tarik modal dari akun stock (Papah) dalam periode
      doubleEntryTxn({ category: 'FIN', amount: 2_000_000, debit: PAPAH, credit: ACC.bank, date: '2026-08-01', description: 'Tarik modal' }),
    ];
    const sce = calculateStatementOfChangesInEquity(txns, periodStart, periodEnd, 0, ACCOUNTS);

    const papah = sce.owners.find((o) => o.stockAccountId === PAPAH.id)!;
    expect(papah.capitalWithdrawals).toBe(2_000_000);
    expect(papah.capitalClosing).toBe(98_000_000);   // 100M - 2M tarik modal
    expect(sce.netIncome).toBe(15_000_000);          // laba operasi murni, tidak berkurang tarik modal
    expect(sce.retainedClosing).toBe(15_000_000);    // RE tidak tercemar tarik modal
    expect(sce.isReconciled).toBe(true);             // guard: was false before the fix
  });
});
