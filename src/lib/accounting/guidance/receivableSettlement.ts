/**
 * Receivable Settlement (Pelunasan Piutang)
 * Utilities for detecting receivable transactions and building settlement entries.
 */

import type { Transaction, TransactionCategory } from '@/types';

/**
 * Returns true if the transaction represents a trade receivable (piutang usaha):
 * - is double-entry
 * - debit account is ASSET type
 * - debit account has default_category === 'EARN' OR name contains "piutang usaha"/"receivable"
 * - explicitly excludes talangan/advance (default_category === 'FIN') — no settlement banner needed
 */
export function isReceivableTransaction(transaction: Transaction): boolean {
  // Single double-entry path
  if (transaction.is_double_entry) {
    if (!transaction.debit_account) return false;
    if (transaction.debit_account.account_type !== 'ASSET') return false;

    // Talangan/advance accounts are NOT trade receivables — no settlement flow
    if (transaction.debit_account.default_category === 'FIN') return false;
    const name = transaction.debit_account.account_name.toLowerCase();
    if (/talangan|advance/i.test(name)) return false;

    // Trade receivable: explicit EARN category or name-based match
    if (transaction.debit_account.default_category === 'EARN') return true;
    return /piutang usaha|receivable/i.test(name);
  }

  // Multi-line path
  if (transaction.is_multi_line && transaction.journal_lines) {
    return transaction.journal_lines.some((line) => {
      if (line.debit_amount <= 0 || !line.account) return false;
      if (line.account.account_type !== 'ASSET') return false;
      if (line.account.default_category === 'FIN') return false;
      const name = line.account.account_name.toLowerCase();
      if (/talangan|advance/i.test(name)) return false;
      if (line.account.default_category === 'EARN') return true;
      return /piutang usaha|receivable/i.test(name);
    });
  }

  return false;
}

/**
 * Returns true if the transaction has already been settled.
 */
export function isSettled(transaction: Transaction): boolean {
  return !!transaction.meta?.settled_by_transaction_id;
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
  date: string;
  name: string;
  description: string;
  category: TransactionCategory;
  is_double_entry: true;
  account: string;
  status: 'posted';
  meta: { settlement_of_transaction_id: string };
}

/**
 * Builds the prefill data for a settlement transaction.
 * Settlement = swap debit/credit: Dr Kas/Bank / Cr Piutang
 */
export function buildSettlementPrefill(original: Transaction): SettlementPrefill {
  return {
    debit_account_id: original.credit_account_id!,
    credit_account_id: original.debit_account_id!,
    amount: original.amount,
    date: new Date().toISOString().slice(0, 10),
    name: original.name,
    description: `Pelunasan piutang: ${original.description}`,
    category: 'EARN',
    is_double_entry: true,
    account: '',
    status: 'posted',
    meta: {
      settlement_of_transaction_id: original.id,
    },
  };
}
