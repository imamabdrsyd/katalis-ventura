import type { Account, TransactionCategory } from '@/types';
import { detectCategory } from './transactionHelpers';

/**
 * Quick Transaction Helper (Model Layer)
 *
 * Resolves a simplified single-account selection into a full double-entry
 * transaction. The user picks ONE account (the "category"), and the system
 * determines:
 *   1. Whether it goes on the debit or credit side
 *   2. What the counter-account is (default cash/bank)
 *   3. The transaction category (EARN, OPEX, VAR, CAPEX, TAX, FIN)
 */

export interface QuickTransactionInput {
  amount: number;
  selectedAccountId: string;
  name: string;
  date: string;
  notes?: string;
}

export interface ResolvedTransaction {
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  amount: number;
  account: string;
  debit_account_id: string;
  credit_account_id: string;
  is_double_entry: boolean;
}

/**
 * Find the default cash/bank account for counter-entry.
 * Looks for active ASSET sub-accounts (accounts with parent_account_id).
 * Prefers 1200 (Bank), falls back to 1100 (Cash), or first available.
 */
export function findDefaultCashAccount(accounts: Account[]): Account | null {
  const cashBankAccounts = accounts
    .filter(
      (acc) =>
        acc.is_active &&
        acc.account_type === 'ASSET' &&
        acc.parent_account_id != null // Only sub-accounts, not main "Assets" parent
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  // Prefer Bank (1200) over Cash (1100)
  const bank = cashBankAccounts.find((acc) => acc.account_code === '1200');
  if (bank) return bank;

  const cash = cashBankAccounts.find((acc) => acc.account_code === '1100');
  if (cash) return cash;

  // Fallback to first available
  return cashBankAccounts[0] || null;
}

/**
 * Determines the debit and credit side based on the selected account type.
 *
 * Rules:
 * - REVENUE              -> Debit: Cash, Credit: Selected  (money IN)
 * - EXPENSE              -> Debit: Selected, Credit: Cash  (money OUT)
 * - ASSET (non-cash)     -> Debit: Selected, Credit: Cash  (buy asset)
 * - LIABILITY            -> Debit: Cash, Credit: Selected  (receive loan)
 * - EQUITY (capital)     -> Debit: Cash, Credit: Selected  (capital injection)
 * - EQUITY (drawings)    -> Debit: Selected, Credit: Cash  (owner withdrawal)
 */
function resolveDebitCredit(
  selectedAccount: Account,
  cashAccount: Account
): { debitAccountId: string; creditAccountId: string; debitCode: string; creditCode: string } {
  const code = selectedAccount.account_code;
  const type = selectedAccount.account_type;
  const name = selectedAccount.account_name.toLowerCase();

  // EXPENSE -> money goes OUT from cash
  // EQUITY Drawings/Prive -> money goes OUT from cash
  // ASSET (non-cash like fixed assets) -> money goes OUT from cash (purchase)
  if (
    type === 'EXPENSE' ||
    (type === 'EQUITY' && (name.includes('prive') || name.includes('drawing'))) ||
    (type === 'ASSET' && code !== '1100' && code !== '1200') // Non-cash assets
  ) {
    return {
      debitAccountId: selectedAccount.id,
      creditAccountId: cashAccount.id,
      debitCode: code,
      creditCode: cashAccount.account_code,
    };
  }

  // REVENUE, LIABILITY, EQUITY (capital/retained) -> money comes IN to cash
  return {
    debitAccountId: cashAccount.id,
    creditAccountId: selectedAccount.id,
    debitCode: cashAccount.account_code,
    creditCode: code,
  };
}

/**
 * Determine a human-readable flow label for the selected account.
 */
export function getFlowLabel(account: Account): string {
  const type = account.account_type;
  const name = account.account_name.toLowerCase();

  if (type === 'REVENUE') return 'Uang Masuk';
  if (type === 'EXPENSE') return 'Uang Keluar';
  if (type === 'LIABILITY') return 'Terima Pinjaman';
  if (type === 'EQUITY' && (name.includes('prive') || name.includes('drawing'))) return 'Penarikan Prive';
  if (type === 'EQUITY') return 'Suntik Modal';
  if (type === 'ASSET' && account.account_code !== '1100' && account.account_code !== '1200') return 'Beli Aset';
  return 'Transaksi';
}

/**
 * Determine whether this is a "money in" or "money out" flow.
 */
export function getFlowDirection(account: Account): 'in' | 'out' {
  const type = account.account_type;
  const name = account.account_name.toLowerCase();

  if (
    type === 'EXPENSE' ||
    (type === 'EQUITY' && (name.includes('prive') || name.includes('drawing'))) ||
    (type === 'ASSET' && account.account_code !== '1100' && account.account_code !== '1200')
  ) {
    return 'out';
  }
  return 'in';
}

/**
 * Main resolver: transforms a quick transaction input into a full
 * double-entry transaction ready for the API.
 */
export function resolveQuickTransaction(
  input: QuickTransactionInput,
  accounts: Account[]
): ResolvedTransaction | { error: string } {
  const selectedAccount = accounts.find((acc) => acc.id === input.selectedAccountId);
  if (!selectedAccount) {
    return { error: 'Akun yang dipilih tidak ditemukan' };
  }

  const cashAccount = findDefaultCashAccount(accounts);
  if (!cashAccount) {
    return { error: 'Tidak ada akun kas/bank yang aktif. Silakan buat akun kas/bank terlebih dahulu.' };
  }

  // Don't allow selecting cash/bank as the category (it would be same-account)
  // Check if it's the same as the default cash account
  if (selectedAccount.id === cashAccount.id) {
    return { error: 'Tidak bisa memilih akun kas/bank sebagai kategori. Gunakan form lengkap untuk transfer antar rekening.' };
  }

  const { debitAccountId, creditAccountId, debitCode, creditCode } = resolveDebitCredit(
    selectedAccount,
    cashAccount
  );

  // Find full account objects to check for default_category
  const debitAccount = debitAccountId === selectedAccount.id
    ? selectedAccount
    : cashAccount;
  const creditAccount = creditAccountId === selectedAccount.id
    ? selectedAccount
    : cashAccount;

  const category = detectCategory(debitCode, creditCode, debitAccount, creditAccount);

  return {
    date: input.date,
    category,
    name: input.name,
    description: input.notes || selectedAccount.account_name,
    amount: input.amount,
    account: 'Double-entry transaction',
    debit_account_id: debitAccountId,
    credit_account_id: creditAccountId,
    is_double_entry: true,
  };
}

/**
 * Filter accounts suitable for the quick-add "Kategori" dropdown.
 * Only shows sub-accounts (with parent_account_id), excluding main parent accounts.
 * Excludes Cash (1100) and Bank (1200) since they are used as the automatic counter-account.
 */
export function getQuickAddAccounts(accounts: Account[]): Account[] {
  // Find the default cash/bank account to exclude it
  const defaultCash = findDefaultCashAccount(accounts);

  return accounts.filter((acc) => {
    if (!acc.is_active) return false;
    if (!acc.parent_account_id) return false; // Exclude main parent accounts (1000, 2000, etc.)
    // Exclude the default counter-account (Cash/Bank) to prevent same-account transactions
    if (defaultCash && acc.id === defaultCash.id) return false;
    // Also exclude the other cash/bank account (both 1100 and 1200 are counter-accounts)
    if (acc.account_code === '1100' || acc.account_code === '1200') return false;
    return true;
  });
}
