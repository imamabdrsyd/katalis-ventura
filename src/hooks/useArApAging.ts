'use client';

import { useMemo } from 'react';
import { useReportData } from './useReportData';
import type { Transaction, ArApSummary, AgingRow, ContactType } from '@/types';

/**
 * Calculate the number of days between a transaction date and the reference (report end) date.
 */
function daysSince(txDate: string, referenceDate: string): number {
  const d1 = new Date(txDate);
  const d2 = new Date(referenceDate);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if a transaction touches a LIABILITY account (for AP).
 * Returns: 'credit' if it creates debt (Cr LIABILITY), 'debit' if it pays debt (Dr LIABILITY), or null.
 */
function getPayableDirection(t: Transaction): 'credit' | 'debit' | null {
  if (!t.is_double_entry) return null;
  if (t.credit_account?.account_type === 'LIABILITY') {
    return 'credit';
  }
  if (t.debit_account?.account_type === 'LIABILITY') {
    return 'debit';
  }
  return null;
}

/**
 * Check if a transaction touches a receivable ASSET account (for AR).
 * Returns: 'debit' if it creates receivable (Dr ASSET), 'credit' if it collects (Cr ASSET), or null.
 */
function getReceivableDirection(t: Transaction): 'debit' | 'credit' | null {
  if (!t.is_double_entry) return null;

  const isReceivableAccount = (acc: { account_type: string; account_name: string; default_category?: string | null }) => {
    if (acc.account_type !== 'ASSET') return false;
    if (acc.default_category === 'FIN') return false;
    if (/talangan|advance/i.test(acc.account_name)) return false;
    if (acc.default_category === 'EARN') return true;
    return /piutang usaha|receivable/i.test(acc.account_name);
  };

  if (t.debit_account && isReceivableAccount(t.debit_account)) {
    return 'debit';
  }
  if (t.credit_account && isReceivableAccount(t.credit_account)) {
    return 'credit';
  }
  return null;
}

interface ContactAgingData {
  contactName: string;
  contactId: string | null;
  contactType: ContactType | null;
  /** Originating transactions sorted by date ascending (oldest first) */
  originatingTxns: Transaction[];
  /** Total payments received/made */
  totalPayments: number;
}

/**
 * Build aging summary by netting payments against outstanding per contact.
 *
 * For AP: outstanding = sum(Cr LIABILITY) - sum(Dr LIABILITY) per contact
 * For AR: outstanding = sum(Dr ASSET receivable) - sum(Cr ASSET receivable) per contact
 *
 * Net outstanding is placed into aging buckets based on the oldest unpaid
 * transaction date (FIFO: payments retire oldest debt first).
 */
function buildAgingSummary(
  transactions: Transaction[],
  referenceDate: string,
  directionFn: (t: Transaction) => 'debit' | 'credit' | null,
  originatingSide: 'credit' | 'debit',
): ArApSummary {
  // Group by contact name, separating originating vs payment transactions
  const byContact = new Map<string, ContactAgingData>();

  for (const t of transactions) {
    const dir = directionFn(t);
    if (dir === null) continue;

    const key = t.contact_id || t.name || 'Tanpa Nama';
    if (!byContact.has(key)) {
      byContact.set(key, {
        contactName: t.contact?.name || t.name || 'Tanpa Nama',
        contactId: t.contact_id ?? null,
        contactType: t.contact?.type ?? null,
        originatingTxns: [],
        totalPayments: 0,
      });
    }
    const data = byContact.get(key)!;

    if (dir === originatingSide) {
      // This creates debt/receivable
      data.originatingTxns.push(t);
    } else {
      // This pays down debt/receivable
      data.totalPayments += Number(t.amount);
    }

    // Update contact info if available
    if (!data.contactType && t.contact?.type) {
      data.contactType = t.contact.type;
    }
    if (!data.contactId && t.contact_id) {
      data.contactId = t.contact_id;
    }
  }

  const rows: AgingRow[] = [];

  for (const [, data] of byContact) {
    // Sort originating transactions by date ascending (oldest first) for FIFO
    data.originatingTxns.sort((a, b) => a.date.localeCompare(b.date));

    // Apply payments FIFO: retire oldest transactions first
    let remainingPayments = data.totalPayments;
    const unpaidTxns: { date: string; amount: number }[] = [];

    for (const t of data.originatingTxns) {
      const amount = Number(t.amount);
      if (remainingPayments >= amount) {
        // Fully paid — skip
        remainingPayments -= amount;
      } else {
        // Partially or not paid
        unpaidTxns.push({ date: t.date, amount: amount - remainingPayments });
        remainingPayments = 0;
      }
    }

    // Skip contacts with no outstanding balance
    if (unpaidTxns.length === 0) continue;

    const row: AgingRow = {
      contactId: data.contactId,
      contactName: data.contactName,
      contactType: data.contactType,
      current: 0,
      bucket30: 0,
      bucket60: 0,
      bucket90: 0,
      bucketOver90: 0,
      total: 0,
      oldestDate: null,
    };

    for (const u of unpaidTxns) {
      const days = daysSince(u.date, referenceDate);

      if (days <= 0) {
        row.current += u.amount;
      } else if (days <= 30) {
        row.bucket30 += u.amount;
      } else if (days <= 60) {
        row.bucket60 += u.amount;
      } else if (days <= 90) {
        row.bucket90 += u.amount;
      } else {
        row.bucketOver90 += u.amount;
      }

      row.total += u.amount;

      if (!row.oldestDate || u.date < row.oldestDate) {
        row.oldestDate = u.date;
      }
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

export function useArApAging() {
  const reportData = useReportData();
  const { transactions, loading, endDate } = reportData;

  const referenceDate = endDate || new Date().toISOString().split('T')[0];

  // AR (Piutang) — receivable ASSET transactions netted against collections
  // Originating side = 'debit' (Dr Piutang creates receivable)
  const arSummary = useMemo(
    () => buildAgingSummary(transactions, referenceDate, getReceivableDirection, 'debit'),
    [transactions, referenceDate]
  );

  // AP (Hutang) — payable LIABILITY transactions netted against payments
  // Originating side = 'credit' (Cr Hutang creates debt)
  const apSummary = useMemo(
    () => buildAgingSummary(transactions, referenceDate, getPayableDirection, 'credit'),
    [transactions, referenceDate]
  );

  return {
    ...reportData,
    arSummary,
    apSummary,
    loading,
  };
}
