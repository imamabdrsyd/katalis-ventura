/**
 * Dividend Settlement (Pelunasan Dividen)
 *
 * Mendukung dua mode pencatatan dividen:
 *   1. Cashout langsung — Dr Dividen / Cr Kas/Bank          (1 transaksi, selesai)
 *   2. Declare (commitment) — Dr Dividen / Cr Hutang Dividen (perlu pelunasan menyusul)
 *      → Pay (full/partial) — Dr Hutang Dividen / Cr Kas/Bank
 *
 * Mirror dari receivableSettlement.ts tapi untuk sisi dividen.
 */

import type { Transaction, Account, TransactionCategory } from '@/types';
import { findDefaultCashAccount } from '@/lib/utils/quickTransactionHelper';

/**
 * Returns the LIABILITY account flagged as Hutang Dividen for this business,
 * or null kalau belum ada (user perlu buat akun-nya dulu).
 */
export function findDividendPayableAccount(accounts: Account[]): Account | null {
  return (
    accounts.find(
      (acc) =>
        acc.is_active &&
        acc.account_type === 'LIABILITY' &&
        acc.is_dividend_payable
    ) ?? null
  );
}

/**
 * Returns true kalau akun ini adalah akun Dividen / Prive (EQUITY drawing).
 * Pakai flag persistent `is_dividend` (bukan string match nama).
 */
export function isDividendAccount(account: Account): boolean {
  return account.account_type === 'EQUITY' && account.is_dividend === true;
}

/**
 * Returns true kalau transaksi ini merepresentasikan DECLARATION dividen
 * (commitment yang belum dibayar):
 *   - double-entry: debit = akun Dividen (EQUITY), credit = akun Hutang Dividen (LIABILITY)
 */
export function isDividendDeclaration(transaction: Transaction): boolean {
  if (transaction.is_double_entry) {
    if (!transaction.debit_account || !transaction.credit_account) return false;
    return (
      transaction.debit_account.account_type === 'EQUITY' &&
      transaction.debit_account.is_dividend === true &&
      transaction.credit_account.account_type === 'LIABILITY' &&
      transaction.credit_account.is_dividend_payable === true
    );
  }
  return false;
}

/**
 * Returns true kalau dividend declaration sudah lunas penuh.
 * Reuse meta field yang sama dengan receivable/payable settlement.
 */
export function isDividendSettled(transaction: Transaction): boolean {
  return !!transaction.meta?.settled_by_transaction_id;
}

/**
 * Helper untuk ambil amount dividen (bisa dari original_amount jika multi-currency)
 */
export function getDividendLineAmount(transaction: Transaction): number {
  return transaction.original_amount ?? transaction.amount;
}

/**
 * Helper untuk ambil id payable account
 */
export function getDividendPayableAccountId(transaction: Transaction): string {
  return transaction.credit_account_id ?? '';
}

/**
 * Outstanding (sisa) dividen yang belum dibayar.
 */
export function getDividendOutstandingAmount(transaction: Transaction, paymentTxns?: Transaction[]): number {
  if (isDividendSettled(transaction)) return 0;
  if (transaction.meta?.remaining_amount !== undefined) {
    return Math.max(0, transaction.meta.remaining_amount);
  }
  
  const originalAmount = getDividendLineAmount(transaction);
  
  // Fallback for legacy partial settlements missing `remaining_amount` in DB
  if (paymentTxns && paymentTxns.length > 0) {
    const partialIds = getDividendPartialSettlementIds(transaction);
    const relatedPayments = paymentTxns.filter(t => partialIds.includes(t.id));
    if (relatedPayments.length > 0) {
      const totalPaid = relatedPayments.reduce((sum, t) => sum + (t.original_amount ?? t.amount), 0);
      return Math.max(0, originalAmount - totalPaid);
    }
  }

  return originalAmount;
}

/**
 * List partial settlement transaction IDs untuk dividen ini.
 */
export function getDividendPartialSettlementIds(transaction: Transaction): string[] {
  return transaction.meta?.partial_settlements ?? [];
}

export interface DividendSettlementPrefill {
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
 * Build prefill untuk pelunasan dividen FULL.
 *
 * Jurnal: Dr Hutang Dividen (LIABILITY) | Cr Kas/Bank
 * Kategori: FIN (pembiayaan — pembayaran dividen ke pemilik)
 */
export function buildDividendSettlementPrefill(
  original: Transaction,
  accounts: Account[],
  paymentTxns?: Transaction[]
): DividendSettlementPrefill {
  const outstanding = getDividendOutstandingAmount(original, paymentTxns);
  const cashAccount = findDefaultCashAccount(accounts);
  const payableAccountId = getDividendPayableAccountId(original);

  return {
    debit_account_id: payableAccountId,
    credit_account_id: cashAccount?.id ?? '',
    amount: outstanding,
    original_amount: original.original_amount ?? outstanding,
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
      settlement_amount: outstanding,
    },
  };
}

/**
 * Build prefill untuk pelunasan dividen PARSIAL.
 */
export function buildDividendPartialSettlementPrefill(
  original: Transaction,
  partialAmount: number,
  accounts: Account[]
): DividendSettlementPrefill {
  const cashAccount = findDefaultCashAccount(accounts);
  const payableAccountId = original.credit_account_id!;

  return {
    debit_account_id: payableAccountId,
    credit_account_id: cashAccount?.id ?? '',
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
    category: 'FIN',
    is_double_entry: true,
    account: '',
    status: 'posted',
    meta: {
      settlement_of_transaction_id: original.id,
      settlement_amount: partialAmount,
    },
  };
}
