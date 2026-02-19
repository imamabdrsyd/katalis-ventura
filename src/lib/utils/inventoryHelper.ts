/**
 * Inventory Helper
 *
 * Utilities for detecting inventory accounts and stock transactions,
 * and converting stock transactions to COGS when inventory is sold.
 */

import type { Transaction, Account } from '@/types';

/**
 * Check if an account is an inventory/stock account.
 */
export function isInventoryAccount(account: Account): boolean {
  if (account.account_type !== 'ASSET') return false;
  if (account.default_category === 'VAR') return true;
  return /persediaan|inventory|stok|barang|bahan/i.test(account.account_name);
}

/**
 * Check if a transaction is a "stock" transaction (inventory purchase).
 * Stock = VAR category with debit account being an inventory account.
 */
export function isStockTransaction(transaction: Transaction): boolean {
  if (transaction.category !== 'VAR') return false;
  if (!transaction.debit_account) return false;
  return isInventoryAccount(transaction.debit_account);
}

/**
 * Find all active stock transactions (inventory that hasn't been converted to COGS yet).
 * These are VAR transactions where debit is an inventory account.
 */
export function getStockTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter(isStockTransaction);
}

/**
 * Find inventory accounts in the business's chart of accounts.
 */
export function getInventoryAccounts(accounts: Account[]): Account[] {
  return accounts.filter((acc) => acc.is_active && isInventoryAccount(acc));
}

/**
 * Find the best COGS/expense account for converting stock to COGS.
 * Prefers accounts with HPP/COGS keywords, falls back to first expense sub-account.
 */
export function findCogsAccount(accounts: Account[]): Account | null {
  const expenseSubAccounts = accounts.filter(
    (acc) => acc.is_active && acc.account_type === 'EXPENSE' && acc.parent_account_id != null
  );

  return (
    expenseSubAccounts.find((acc) =>
      /cogs|hpp|harga pokok|cost of|biaya pokok/i.test(acc.account_name)
    ) || expenseSubAccounts[0] || null
  );
}

export interface StockToCOGSUpdate {
  transactionId: string;
  newDebitAccountId: string; // COGS account
  // Keep everything else the same - category stays VAR, credit stays Cash/Bank
}

/**
 * Build the update payload to convert a stock transaction to COGS.
 * Changes only the debit account from Inventory to COGS/Expense.
 * The badge will automatically change from "Stock" to "VAR" because
 * isInventoryTransaction() checks if debit is an inventory account.
 */
export function buildStockToCOGSUpdate(
  stockTransaction: Transaction,
  cogsAccount: Account
): StockToCOGSUpdate {
  return {
    transactionId: stockTransaction.id,
    newDebitAccountId: cogsAccount.id,
  };
}
