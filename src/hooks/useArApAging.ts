'use client';

import { useMemo } from 'react';
import { useReportData } from './useReportData';
import { isTradeReceivableTransaction, isSettled, isSettlementEntry, getOutstandingAmount } from '@/lib/accounting/guidance/receivableSettlement';
import { isPayableTransaction, isPayableSettled, isPayableSettlementEntry } from '@/lib/accounting/guidance/payableSettlement';
import type { Transaction, ArApSummary, AgingRow, RepaymentRow, RepaymentSummary } from '@/types';

/**
 * Calculate the number of days between a transaction date and the reference (report end) date.
 */
function daysSince(txDate: string, referenceDate: string): number {
  const d1 = new Date(txDate);
  const d2 = new Date(referenceDate);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Group outstanding transactions into aging buckets by contact name.
 */
function buildAgingSummary(
  transactions: Transaction[],
  referenceDate: string,
  filterFn: (t: Transaction) => boolean,
  isSettledFn: (t: Transaction) => boolean,
  isEntryFn: (t: Transaction) => boolean,
  getAmountFn: (t: Transaction) => number = (t) => Number(t.amount),
): ArApSummary {
  // Filter: matching transactions that are NOT settled and NOT themselves settlement entries
  const outstanding = transactions.filter(
    (t) => filterFn(t) && !isSettledFn(t) && !isEntryFn(t)
  );

  // Group by contact name
  const byContact = new Map<string, Transaction[]>();
  for (const t of outstanding) {
    const name = t.name || 'Tanpa Nama';
    const list = byContact.get(name) || [];
    list.push(t);
    byContact.set(name, list);
  }

  const rows: AgingRow[] = [];

  for (const [contactName, txns] of byContact) {
    const row: AgingRow = {
      contactId: txns[0].contact_id ?? null,
      contactName,
      contactType: null,
      current: 0,
      bucket30: 0,
      bucket60: 0,
      bucket90: 0,
      bucketOver90: 0,
      total: 0,
      oldestDate: null,
    };

    for (const t of txns) {
      const amount = getAmountFn(t);
      const days = daysSince(t.date, referenceDate);

      if (days <= 30) {
        row.current += amount;
      } else if (days <= 60) {
        row.bucket30 += amount;
      } else if (days <= 90) {
        row.bucket60 += amount;
      } else if (days <= 120) {
        row.bucket90 += amount;
      } else {
        row.bucketOver90 += amount;
      }

      row.total += amount;

      if (!row.oldestDate || t.date < row.oldestDate) {
        row.oldestDate = t.date;
      }
    }

    // Try to get contact type from the first transaction's contact
    if (txns[0].contact) {
      row.contactType = txns[0].contact.type;
    }

    rows.push(row);
  }

  // Sort by total descending (biggest outstanding first)
  rows.sort((a, b) => b.total - a.total);

  // Compute summary totals
  const summary: ArApSummary = {
    totalCurrent: 0,
    total30: 0,
    total60: 0,
    total90: 0,
    totalOver90: 0,
    grandTotal: 0,
    rows,
  };

  for (const r of rows) {
    summary.totalCurrent += r.current;
    summary.total30 += r.bucket30;
    summary.total60 += r.bucket60;
    summary.total90 += r.bucket90;
    summary.totalOver90 += r.bucketOver90;
    summary.grandTotal += r.total;
  }

  return summary;
}

/**
 * Detect repayment/collection transactions:
 * - AP repayment: Dr LIABILITY (bisnis bayar hutang)
 * - AR collection: Cr receivable ASSET (pihak lain bayar piutang ke bisnis)
 */
function buildRepaymentSummary(transactions: Transaction[]): RepaymentSummary {
  const rows: RepaymentRow[] = [];
  let totalApRepaid = 0;
  let totalArCollected = 0;
  let totalApRepaidNonSettlement = 0;
  let totalArCollectedNonSettlement = 0;

  for (const t of transactions) {
    if (!t.is_double_entry) continue;

    const isSettlementTx = !!t.meta?.settlement_of_transaction_id;

    // AP repayment: Dr LIABILITY / Cr Kas-Bank
    if (t.debit_account?.account_type === 'LIABILITY') {
      const amount = Number(t.amount);
      rows.push({
        id: t.id,
        date: t.date,
        contactName: t.name || 'Tanpa Nama',
        contactId: t.contact_id ?? null,
        contactType: t.contact?.type ?? null,
        description: t.description,
        amount,
        type: 'ap',
      });
      totalApRepaid += amount;
      if (!isSettlementTx) totalApRepaidNonSettlement += amount;
    }

    // AR collection: Cr receivable ASSET / Dr Kas-Bank
    if (t.credit_account?.account_type === 'ASSET') {
      const acct = t.credit_account;
      if (acct.default_category === 'FIN') continue;
      if (/talangan|advance/i.test(acct.account_name)) continue;
      const isReceivable = acct.default_category === 'EARN' || /piutang usaha|receivable/i.test(acct.account_name);
      if (!isReceivable) continue;

      const amount = Number(t.amount);
      rows.push({
        id: t.id,
        date: t.date,
        contactName: t.name || 'Tanpa Nama',
        contactId: t.contact_id ?? null,
        contactType: t.contact?.type ?? null,
        description: t.description,
        amount,
        type: 'ar',
      });
      totalArCollected += amount;
      if (!isSettlementTx) totalArCollectedNonSettlement += amount;
    }
  }

  // Sort by date descending (most recent first)
  rows.sort((a, b) => b.date.localeCompare(a.date));

  return { rows, totalApRepaid, totalArCollected, totalApRepaidNonSettlement, totalArCollectedNonSettlement };
}

export function useArApAging() {
  const reportData = useReportData();
  const { transactions, loading, endDate } = reportData;

  const referenceDate = endDate || new Date().toISOString().split('T')[0];

  // AR (Piutang) — receivable transactions that haven't been settled
  const arSummary = useMemo(
    () => buildAgingSummary(transactions, referenceDate, isTradeReceivableTransaction, isSettled, isSettlementEntry, getOutstandingAmount),
    [transactions, referenceDate]
  );

  // AP (Hutang) — payable transactions that haven't been settled
  const apSummary = useMemo(
    () => buildAgingSummary(transactions, referenceDate, isPayableTransaction, isPayableSettled, isPayableSettlementEntry),
    [transactions, referenceDate]
  );

  // Repayment history (pembayaran hutang + pelunasan piutang)
  const repaymentSummary = useMemo(
    () => buildRepaymentSummary(transactions),
    [transactions]
  );

  // Net summaries: outstanding - non-settlement repayments only
  // Settlement entries (with meta.settlement_of_transaction_id) are already excluded
  // from aging via isSettled/isSettlementEntry, so only subtract collections that
  // were NOT created through the settlement flow to avoid double subtraction.
  const netArTotal = arSummary.grandTotal - repaymentSummary.totalArCollectedNonSettlement;
  const netApTotal = apSummary.grandTotal - repaymentSummary.totalApRepaidNonSettlement;

  return {
    ...reportData,
    arSummary,
    apSummary,
    repaymentSummary,
    netArTotal,
    netApTotal,
    loading,
  };
}
