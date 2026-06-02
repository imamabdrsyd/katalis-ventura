/**
 * Payable Settlement (Pelunasan Hutang)
 * Utilities for detecting payable transactions and building settlement entries.
 * Mirror of receivableSettlement.ts for the AP (Accounts Payable) side.
 */

import type { Transaction, TransactionCategory, Account } from '@/types';
import { findDefaultCashAccount } from '@/lib/utils/quickTransactionHelper';

/**
 * Returns true if the transaction represents a payable (hutang):
 * - is double-entry: credit account is LIABILITY type with "hutang/utang/payable" name
 * - OR is multi-line: any credit journal line hits a LIABILITY account with matching name
 */
export function isPayableTransaction(transaction: Transaction): boolean {
  // Multi-line dicek lebih dulu: transaksi multi-line punya is_double_entry = TRUE
  // (lihat update_multi_line_transaction RPC) tapi credit_account-nya NULL karena
  // akun ada di journal_lines. Cek struktur multi-line dulu agar tidak salah jalur.
  // Multi-line path — any credit line to a LIABILITY account counts as payable
  if (transaction.is_multi_line && transaction.journal_lines) {
    return transaction.journal_lines.some(
      (line) => line.credit_amount > 0 && line.account?.account_type === 'LIABILITY'
    );
  }

  // Single double-entry path
  if (transaction.is_double_entry) {
    if (!transaction.credit_account) return false;
    if (transaction.credit_account.account_type !== 'LIABILITY') return false;
    return /hutang|utang|payable/i.test(transaction.credit_account.account_name);
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
  meta: { settlement_of_transaction_id: string };
}

/**
 * Finds the payable (hutang) account ID from the original transaction.
 * For single double-entry: the credit account is the liability.
 * For multi-line: the first credit line hitting a LIABILITY account.
 */
function getPayableAccountId(original: Transaction): string {
  if (original.is_multi_line && original.journal_lines) {
    const line = original.journal_lines.find(
      (l) => l.credit_amount > 0 && l.account?.account_type === 'LIABILITY'
    );
    if (line) return line.account_id;
  }
  return original.credit_account_id!;
}

/**
 * Builds the prefill data for a payable settlement transaction.
 *
 * Correct journal: Dr Hutang (LIABILITY)  |  Cr Kas/Bank (1200/1100)
 * NOT a swap of the original entry.
 */
export function buildPayableSettlementPrefill(original: Transaction, accounts: Account[]): PayableSettlementPrefill {
  const cashAccount = findDefaultCashAccount(accounts);
  const payableAccountId = getPayableAccountId(original);

  return {
    debit_account_id: payableAccountId,
    credit_account_id: cashAccount?.id ?? '',
    amount: original.amount,
    original_amount: original.original_amount ?? original.amount,
    currency_code: original.currency_code ?? 'IDR',
    fx_rate: original.fx_rate ?? 1,
    fx_rate_date: new Date().toISOString().slice(0, 10),
    date: new Date().toISOString().slice(0, 10),
    name: original.name,
    description: original.description,
    category: 'FIN',
    is_double_entry: true,
    account: '',
    status: 'posted',
    meta: {
      settlement_of_transaction_id: original.id,
    },
  };
}
