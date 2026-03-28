/**
 * Payable Settlement (Pelunasan Hutang)
 * Utilities for detecting payable transactions and building settlement entries.
 * Mirror of receivableSettlement.ts for the AP (Accounts Payable) side.
 */

import type { Transaction, TransactionCategory } from '@/types';

/**
 * Returns true if the transaction represents a payable (hutang):
 * - is double-entry: credit account is LIABILITY type with "hutang/utang/payable" name
 * - OR is multi-line: any credit journal line hits a LIABILITY account with matching name
 */
export function isPayableTransaction(transaction: Transaction): boolean {
  // Single double-entry path
  if (transaction.is_double_entry) {
    if (!transaction.credit_account) return false;
    if (transaction.credit_account.account_type !== 'LIABILITY') return false;
    return /hutang|utang|payable/i.test(transaction.credit_account.account_name);
  }

  // Multi-line path
  if (transaction.is_multi_line && transaction.journal_lines) {
    return transaction.journal_lines.some(
      (line) =>
        line.credit_amount > 0 &&
        line.account?.account_type === 'LIABILITY' &&
        /hutang|utang|payable/i.test(line.account.account_name)
    );
  }

  return false;
}

/**
 * Returns true if the payable transaction has already been settled.
 * Reuses the same meta field as receivable settlement.
 */
export function isPayableSettled(transaction: Transaction): boolean {
  return !!transaction.meta?.settled_by_transaction_id;
}

/**
 * Returns true if this transaction is itself a payable settlement entry.
 */
export function isPayableSettlementEntry(transaction: Transaction): boolean {
  return !!transaction.meta?.settlement_of_transaction_id;
}

export interface PayableSettlementPrefill {
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
 * Builds the prefill data for a payable settlement transaction.
 * Settlement = swap debit/credit: Dr Hutang / Cr Kas/Bank
 */
export function buildPayableSettlementPrefill(original: Transaction): PayableSettlementPrefill {
  return {
    debit_account_id: original.credit_account_id!,
    credit_account_id: original.debit_account_id!,
    amount: original.amount,
    date: new Date().toISOString().slice(0, 10),
    name: original.name,
    description: `Pelunasan hutang: ${original.description}`,
    category: 'FIN',
    is_double_entry: true,
    account: '',
    status: 'posted',
    meta: {
      settlement_of_transaction_id: original.id,
    },
  };
}
