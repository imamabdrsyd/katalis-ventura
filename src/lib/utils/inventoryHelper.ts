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

/**
 * Turunkan item katalog sebuah penjualan dari transaksi stok yang dilepasnya.
 *
 * Dipakai supaya transaksi JUAL ikut membawa `meta.catalog_item` seperti
 * transaksi BELI. Tanpa ini Asset Console hanya melihat sisi beli dan posisi
 * terbaca bruto (mis. BBCA 7 lot padahal tersisa 1 lot setelah dua kali jual).
 *
 * Mengembalikan null bila stok yang dilepas berasal dari lebih dari satu item
 * katalog — penjualan campuran tidak boleh ditebak sepihak.
 */
export function deriveCatalogItemFromStock(
  soldStockIds: string[],
  allTransactions: Transaction[]
): { id: string; name: string } | null {
  if (soldStockIds.length === 0) return null;

  const ids = new Set(soldStockIds);
  const picked = allTransactions
    .filter((t) => ids.has(t.id))
    .map((t) => t.meta?.catalog_item)
    .filter((c): c is { id: string; name: string } => !!c?.id);

  if (picked.length === 0) return null;
  const first = picked[0];
  return picked.every((c) => c.id === first.id) ? first : null;
}

export interface StockToCOGSUpdate {
  transactionId: string;
  newDebitAccountId: string; // COGS account
  // Keep everything else the same - category stays VAR, credit stays Cash/Bank
}

/**
 * Build the update payload to convert a stock transaction to COGS.
 * Changes only the debit account from Inventory to COGS/Expense.
 * The badge will automatically change from "Inventory" to "VAR" because
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
