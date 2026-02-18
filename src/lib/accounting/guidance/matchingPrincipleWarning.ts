/**
 * Matching Principle Warning
 * Detects when a completed EARN transaction requires a follow-up
 * COGS/Inventory reduction entry.
 */

import type { Transaction, Account } from '@/types';

export interface MatchingPrincipleWarning {
  /** The inventory account found in the business's COA */
  inventoryAccount: Account;
  /** Suggested COGS/expense account (or null if none found) */
  cogsAccount: Account | null;
  /** Human-readable title */
  title: string;
  /** Body text explaining the issue */
  body: string;
  /** Pre-formatted journal entry hint */
  journalHint: string;
}

/**
 * Check if an account is an inventory/stock account.
 */
function isInventoryAccount(account: Account): boolean {
  if (account.account_type !== 'ASSET') return false;
  if (account.default_category === 'VAR') return true;
  return /persediaan|inventory|stok|barang|bahan/i.test(account.account_name);
}

/**
 * Detects whether a completed EARN transaction requires a follow-up
 * COGS/Inventory reduction entry (Matching Principle).
 *
 * Returns a warning object if guidance should be shown, null otherwise.
 */
export function detectMatchingPrincipleWarning(
  transaction: Transaction,
  allAccounts: Account[]
): MatchingPrincipleWarning | null {
  // Only trigger for EARN category
  if (transaction.category !== 'EARN') return null;

  // Only trigger for double-entry with a REVENUE credit account
  if (!transaction.is_double_entry) return null;
  if (!transaction.credit_account) return null;
  if (transaction.credit_account.account_type !== 'REVENUE') return null;

  // If credit account is itself an inventory account, no warning needed
  if (isInventoryAccount(transaction.credit_account)) return null;

  // Find inventory accounts in the business's COA
  const inventoryAccounts = allAccounts.filter(
    (acc) => acc.is_active && isInventoryAccount(acc)
  );

  // No inventory accounts = service business, no warning needed
  if (inventoryAccounts.length === 0) return null;

  const inventoryAccount = inventoryAccounts[0];

  // Find COGS/expense account suggestion
  const activeExpenseAccounts = allAccounts.filter(
    (acc) => acc.is_active && acc.account_type === 'EXPENSE' && acc.parent_account_id != null
  );

  const cogsAccount =
    activeExpenseAccounts.find((acc) =>
      /cogs|hpp|harga pokok|cost of|biaya pokok/i.test(acc.account_name)
    ) || activeExpenseAccounts[0] || null;

  return {
    inventoryAccount,
    cogsAccount,
    title: 'Perlu Entry Tambahan?',
    body:
      'Transaksi penjualan ini mencatat pendapatan, tetapi persediaan belum dikurangi. ' +
      'Prinsip Matching mengharuskan pencatatan HPP (Harga Pokok Penjualan) ' +
      'pada periode yang sama dengan pendapatan.',
    journalHint:
      `Debit: ${cogsAccount ? `${cogsAccount.account_code} - ${cogsAccount.account_name}` : 'Akun HPP/Beban'} | ` +
      `Credit: ${inventoryAccount.account_code} - ${inventoryAccount.account_name}`,
  };
}
