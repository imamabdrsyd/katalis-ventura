/**
 * Receivable Settlement (Pelunasan Piutang)
 * Utilities for detecting receivable transactions and building settlement entries.
 */

import type { Transaction, TransactionCategory, Account } from '@/types';
import { findDefaultCashAccount } from '@/lib/utils/quickTransactionHelper';
import {
  isTradeReceivableAccount,
  isAnyReceivableAccount,
} from '@/lib/accounting/classification';

/**
 * Returns true if the transaction represents ANY receivable (piutang),
 * including both trade receivables (piutang usaha) and advances/talangan.
 *
 * Used by the settlement flow — any kind of receivable can be settled.
 */
export function isReceivableTransaction(transaction: Transaction): boolean {
  // Multi-line dicek lebih dulu: transaksi multi-line punya is_double_entry = TRUE
  // (lihat update_multi_line_transaction RPC), tapi debit_account-nya NULL karena
  // akun ada di journal_lines. Cek struktur multi-line dulu agar tidak salah jalur.
  if (transaction.is_multi_line && transaction.journal_lines) {
    return transaction.journal_lines.some(
      (line) => line.debit_amount > 0 && isAnyReceivableAccount(line.account)
    );
  }

  if (transaction.is_double_entry) {
    return isAnyReceivableAccount(transaction.debit_account);
  }

  return false;
}

/**
 * Returns true if the transaction represents a TRADE receivable only (piutang usaha):
 * - Excludes talangan/advance/loan receivable
 * - Used for AR aging report and invoice generation
 */
export function isTradeReceivableTransaction(transaction: Transaction): boolean {
  // Multi-line dicek lebih dulu (lihat catatan di isReceivableTransaction).
  if (transaction.is_multi_line && transaction.journal_lines) {
    return transaction.journal_lines.some(
      (line) => line.debit_amount > 0 && isTradeReceivableAccount(line.account)
    );
  }

  if (transaction.is_double_entry) {
    return isTradeReceivableAccount(transaction.debit_account);
  }

  return false;
}

/**
 * Returns true if the transaction has been fully settled.
 */
export function isSettled(transaction: Transaction): boolean {
  return !!transaction.meta?.settled_by_transaction_id;
}

/**
 * Returns true if the transaction has been partially settled (at least one partial payment).
 */
export function isPartiallySettled(transaction: Transaction): boolean {
  return (
    !isSettled(transaction) &&
    Array.isArray(transaction.meta?.partial_settlements) &&
    transaction.meta!.partial_settlements!.length > 0
  );
}

/**
 * Returns the receivable (piutang) amount yang sebenarnya tercatat pada transaksi —
 * yaitu net debit pada akun receivable saja, BUKAN total header `amount`.
 *
 * Penting untuk multi-line: pada transaksi seperti penjualan OTA, `transaction.amount`
 * = total debit (gross revenue, mis. 1.200.000), tapi yang menjadi piutang & yang akan
 * masuk ke kas hanyalah baris akun piutang (net diterima, mis. 969.563). Baris beban
 * (komisi/biaya/pajak) sudah memotong gross di muka. Memakai header `amount` membuat
 * settlement meng-overstate kas masuk & meng-overclear piutang (lihat Issue #26).
 *
 * Single double-entry: baris piutang = seluruh `transaction.amount`, jadi sama saja.
 */
export function getReceivableLineAmount(transaction: Transaction): number {
  if (transaction.is_multi_line && transaction.journal_lines) {
    const net = transaction.journal_lines
      .filter((l) => isAnyReceivableAccount(l.account))
      .reduce((sum, l) => sum + (l.debit_amount - l.credit_amount), 0);
    // Fallback ke header amount kalau (tak terduga) tidak ada baris receivable terdeteksi.
    return net > 0 ? net : transaction.amount;
  }
  return transaction.amount;
}

/**
 * Returns the outstanding (remaining) amount on a receivable.
 * If fully settled → 0.
 * If partially settled → remaining_amount from meta (or falls back to receivable line amount).
 * Otherwise → receivable line amount (net, bukan gross header amount).
 */
export function getOutstandingAmount(transaction: Transaction, paymentTxns?: Transaction[]): number {
  if (isSettled(transaction)) return 0;
  if (transaction.meta?.remaining_amount !== undefined) {
    console.log('--- getOutstandingAmount EXIT EARLY ---');
    console.log('remaining_amount found:', transaction.meta.remaining_amount);
    return Math.max(0, transaction.meta.remaining_amount);
  }
  
  const originalAmount = getReceivableLineAmount(transaction);
  
  console.log('--- getOutstandingAmount ENTRY ---');
  console.log('originalAmount:', originalAmount);
  console.log('paymentTxns length:', paymentTxns?.length);
  console.log('partialIds:', getPartialSettlementIds(transaction));
  
  // Fallback for legacy partial settlements missing `remaining_amount` in DB
  if (paymentTxns && paymentTxns.length > 0) {
    const partialIds = getPartialSettlementIds(transaction);
    const relatedPayments = paymentTxns.filter(t => partialIds.includes(t.id));
    console.log('relatedPayments length:', relatedPayments.length);
    if (relatedPayments.length > 0) {
      const totalPaid = relatedPayments.reduce((sum, t) => sum + t.amount, 0);
      console.log('--- getOutstandingAmount DEBUG ---');
      console.log('originalAmount:', originalAmount);
      console.log('totalPaid:', totalPaid);
      console.log('returning:', Math.max(0, originalAmount - totalPaid));
      return Math.max(0, originalAmount - totalPaid);
    }
  }

  return originalAmount;
}

/**
 * Returns list of partial settlement transaction IDs, newest-first if available.
 */
export function getPartialSettlementIds(transaction: Transaction): string[] {
  return transaction.meta?.partial_settlements ?? [];
}

/**
 * Returns true if this transaction is itself a settlement entry.
 */
export function isSettlementEntry(transaction: Transaction): boolean {
  return !!transaction.meta?.settlement_of_transaction_id;
}

export interface SettlementPrefill {
  debit_account_id: string;
  credit_account_id: string;
  amount: number;
  original_amount?: number | null;
  currency_code?: string | null;
  fx_rate?: number | null;
  fx_rate_date?: string | null;
  date: string;
  name: string;
  description: string;
  category: TransactionCategory;
  is_double_entry: true;
  account: string;
  status: 'posted';
  meta: {
    settlement_of_transaction_id: string;
    settlement_amount?: number;
  };
}

/**
 * Finds the receivable (piutang) account ID from the original transaction.
 * For single double-entry: the debit account is the receivable.
 * For multi-line: the first debit line hitting a RECEIVABLE account —
 * filter dengan isAnyReceivableAccount, konsisten dengan deteksi di
 * isReceivableTransaction. Penjualan campuran (Dr Bank + Dr Piutang) tidak
 * boleh memilih baris Bank hanya karena ASSET pertama (audit ACC-H2).
 */
function getReceivableAccountId(original: Transaction): string {
  if (original.is_multi_line && original.journal_lines) {
    const line = original.journal_lines.find(
      (l) => l.debit_amount > 0 && isAnyReceivableAccount(l.account)
    );
    if (line) return line.account_id;
  }
  return original.debit_account_id!;
}

/**
 * Returns the appropriate settlement category based on the receivable account type.
 * - Talangan/advance (FIN) → FIN (penerimaan kembali dana, bukan revenue)
 * - Piutang usaha (EARN) → EARN (pelunasan dari customer)
 */
function getSettlementCategory(original: Transaction): TransactionCategory {
  if (original.is_multi_line && original.journal_lines) {
    const line = original.journal_lines.find(
      (l) => l.debit_amount > 0 && isAnyReceivableAccount(l.account)
    );
    if (line?.account?.default_category === 'FIN') return 'FIN';
  }
  if (original.debit_account?.default_category === 'FIN') return 'FIN';
  return 'EARN';
}

/**
 * Builds the prefill data for a FULL settlement transaction.
 *
 * Piutang usaha:  Dr Kas/Bank (1200/1100)  |  Cr Piutang Usaha   (category: EARN)
 * Piutang talangan: Dr Kas/Bank            |  Cr Piutang Talangan (category: FIN)
 */
export function buildSettlementPrefill(
  original: Transaction, 
  accounts: Account[], 
  paymentTxns?: Transaction[]
): SettlementPrefill {
  const outstanding = getOutstandingAmount(original, paymentTxns);
  const cashAccount = findDefaultCashAccount(accounts);
  const receivableAccountId = getReceivableAccountId(original);
  const category = getSettlementCategory(original);

  return {
    debit_account_id: cashAccount?.id ?? '',
    credit_account_id: receivableAccountId,
    amount: outstanding,
    original_amount: original.original_amount ?? outstanding,
    currency_code: original.currency_code ?? 'IDR',
    fx_rate: original.fx_rate ?? 1,
    fx_rate_date: new Date().toISOString().slice(0, 10),
    date: new Date().toISOString().slice(0, 10),
    name: original.name,
    description: original.description,
    category,
    is_double_entry: true,
    account: '',
    status: 'posted',
    meta: {
      settlement_of_transaction_id: original.id,
      settlement_amount: outstanding,
    },
  };
}

export interface PartialSettlementPrefill extends SettlementPrefill {
  meta: {
    settlement_of_transaction_id: string;
    settlement_amount: number;
  };
}

/**
 * Builds the prefill data for a PARTIAL settlement transaction.
 *
 * Piutang usaha:    Dr Kas/Bank  |  Cr Piutang Usaha    (category: EARN)
 * Piutang talangan: Dr Kas/Bank  |  Cr Piutang Talangan (category: FIN)
 */
export function buildPartialSettlementPrefill(
  original: Transaction,
  partialAmount: number,
  accounts: Account[],
  paymentTxns?: Transaction[]
): PartialSettlementPrefill {
  const cashAccount = findDefaultCashAccount(accounts);
  const receivableAccountId = getReceivableAccountId(original);
  const category = getSettlementCategory(original);

  return {
    debit_account_id: cashAccount?.id ?? '',
    credit_account_id: receivableAccountId,
    amount: partialAmount,
    original_amount: original.currency_code && original.currency_code !== 'IDR' && original.fx_rate
      ? partialAmount / original.fx_rate
      : partialAmount,
    currency_code: original.currency_code ?? 'IDR',
    fx_rate: original.fx_rate ?? 1,
    fx_rate_date: new Date().toISOString().slice(0, 10),
    date: new Date().toISOString().slice(0, 10),
    name: original.name,
    description: original.description,
    category,
    is_double_entry: true,
    account: '',
    status: 'posted',
    meta: {
      settlement_of_transaction_id: original.id,
      settlement_amount: partialAmount,
    },
  };
}
