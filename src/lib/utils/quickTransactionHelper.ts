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
 * Prefers 1120 (Bank BCA), falls back to first active cash/bank account.
 */
export function findDefaultCashAccount(accounts: Account[]): Account | null {
  const cashBankAccounts = accounts
    .filter(
      (acc) =>
        acc.is_active &&
        acc.account_code >= '1110' &&
        acc.account_code <= '1132'
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  // Prefer 1120 (Bank BCA) as default
  const preferred = cashBankAccounts.find((acc) => acc.account_code === '1120');
  return preferred || cashBankAccounts[0] || null;
}

/**
 * Determines the debit and credit side based on the selected account type.
 *
 * Rules:
 * - REVENUE (4xxx)          -> Debit: Cash, Credit: Selected  (money IN)
 * - EXPENSE (5xxx)          -> Debit: Selected, Credit: Cash  (money OUT)
 * - ASSET Fixed (12xx)      -> Debit: Selected, Credit: Cash  (buy asset)
 * - LIABILITY (2xxx)        -> Debit: Cash, Credit: Selected  (receive loan)
 * - EQUITY Capital (3100)   -> Debit: Cash, Credit: Selected  (capital injection)
 * - EQUITY Drawings (3300)  -> Debit: Selected, Credit: Cash  (owner withdrawal)
 * - EQUITY Retained (3200)  -> Debit: Cash, Credit: Selected  (retained earnings adj)
 */
function resolveDebitCredit(
  selectedAccount: Account,
  cashAccount: Account
): { debitAccountId: string; creditAccountId: string; debitCode: string; creditCode: string } {
  const code = selectedAccount.account_code;
  const type = selectedAccount.account_type;

  // EXPENSE or Owner Drawings or Fixed Assets -> money goes OUT from cash
  if (
    type === 'EXPENSE' ||
    code === '3300' ||
    (type === 'ASSET' && code >= '1200' && code <= '1299')
  ) {
    return {
      debitAccountId: selectedAccount.id,
      creditAccountId: cashAccount.id,
      debitCode: code,
      creditCode: cashAccount.account_code,
    };
  }

  // REVENUE, LIABILITY, EQUITY (non-drawings) -> money comes IN to cash
  // Also ASSET cash-to-cash transfers are excluded (handled by filter)
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
  const code = account.account_code;
  const type = account.account_type;

  if (type === 'REVENUE') return 'Uang Masuk';
  if (type === 'EXPENSE') return 'Uang Keluar';
  if (type === 'LIABILITY') return 'Terima Pinjaman';
  if (type === 'EQUITY' && code === '3300') return 'Penarikan Prive';
  if (type === 'EQUITY') return 'Suntik Modal';
  if (type === 'ASSET' && code >= '1200') return 'Beli Aset';
  return 'Transaksi';
}

/**
 * Determine whether this is a "money in" or "money out" flow.
 */
export function getFlowDirection(account: Account): 'in' | 'out' {
  const code = account.account_code;
  const type = account.account_type;

  if (
    type === 'EXPENSE' ||
    code === '3300' ||
    (type === 'ASSET' && code >= '1200' && code <= '1299')
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
  if (
    selectedAccount.account_code >= '1110' &&
    selectedAccount.account_code <= '1132'
  ) {
    return { error: 'Tidak bisa memilih akun kas/bank sebagai kategori. Gunakan form lengkap untuk transfer antar rekening.' };
  }

  const { debitAccountId, creditAccountId, debitCode, creditCode } = resolveDebitCredit(
    selectedAccount,
    cashAccount
  );

  const category = detectCategory(debitCode, creditCode);

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
 * Excludes cash/bank accounts (they are the implicit counter-account).
 */
export function getQuickAddAccounts(accounts: Account[]): Account[] {
  return accounts.filter((acc) => {
    if (!acc.is_active) return false;
    // Exclude cash & bank accounts (1110-1132) - these are counter-accounts
    if (acc.account_code >= '1110' && acc.account_code <= '1132') return false;
    return true;
  });
}
