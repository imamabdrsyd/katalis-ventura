import type { TransactionCategory, Account } from '@/types';

/**
 * Get account type from code range
 */
function getAccountTypeFromCode(code: string): string {
  const num = parseInt(code);
  if (num >= 1000 && num < 2000) return 'ASSET';
  if (num >= 2000 && num < 3000) return 'LIABILITY';
  if (num >= 3000 && num < 4000) return 'EQUITY';
  if (num >= 4000 && num < 5000) return 'REVENUE';
  if (num >= 5000 && num < 6000) return 'EXPENSE';
  return 'UNKNOWN';
}

/**
 * Auto-detect transaction category based on debit and credit account codes
 *
 * Priority:
 * 1. Check if accounts have default_category set (most specific)
 * 2. Fall back to account type + code based detection
 *
 * Uses account_type-based logic for flexibility with user-created sub-accounts
 */
export function detectCategory(
  debitAccountCode: string,
  creditAccountCode: string,
  debitAccount?: Account,  // Optional: full account object with default_category
  creditAccount?: Account  // Optional: full account object with default_category
): TransactionCategory {
  // Priority 1: Check if accounts have explicit default_category
  // Skip cash/bank accounts (1100, 1200) - they don't determine transaction category
  const CASH_CODES = ['1100', '1200'];
  const debitIsCash = CASH_CODES.includes(debitAccountCode);
  const creditIsCash = CASH_CODES.includes(creditAccountCode);

  // Prefer the non-cash account's default_category
  if (!debitIsCash && debitAccount?.default_category) {
    return debitAccount.default_category;
  }
  if (!creditIsCash && creditAccount?.default_category) {
    return creditAccount.default_category;
  }
  // If both are non-cash, fallback to whichever has a category
  if (debitAccount?.default_category) {
    return debitAccount.default_category;
  }
  if (creditAccount?.default_category) {
    return creditAccount.default_category;
  }

  // Priority 2: Fall back to account type detection
  const debitType = getAccountTypeFromCode(debitAccountCode);
  const creditType = getAccountTypeFromCode(creditAccountCode);

  // Money IN flow: Asset debit (money received), Revenue credit
  if (debitType === 'ASSET') {
    if (creditType === 'REVENUE') return 'EARN';
    if (creditType === 'LIABILITY') return 'FIN'; // Loan received
    if (creditType === 'EQUITY') return 'FIN'; // Capital injection
  }

  // Money OUT flow: Asset credit (paying from bank/cash)
  if (creditType === 'ASSET') {
    if (debitType === 'EXPENSE') return 'OPEX'; // Default expense category
    if (debitType === 'ASSET') return 'CAPEX'; // Asset purchase (e.g. equipment)
    if (debitType === 'EQUITY') return 'FIN'; // Owner withdrawal
    if (debitType === 'LIABILITY') return 'FIN'; // Liability payment
  }

  // Default fallback
  return 'OPEX';
}

/**
 * Filter accounts based on transaction mode and role
 * Uses account_type for flexible filtering with any sub-account structure
 * Only shows sub-accounts (with parent_account_id) since main accounts are categories
 */
export type FilterMode = 'in-destination' | 'in-source' | 'out-source' | 'out-destination' | null;

export function filterAccountsByMode(
  accounts: Account[],
  mode: FilterMode
): Account[] {
  if (!mode) return accounts;

  switch (mode) {
    case 'in-destination': // Where money goes (Uang Masuk Ke) - Asset sub-accounts
      return accounts.filter(
        (acc) =>
          acc.account_type === 'ASSET' &&
          acc.parent_account_id != null &&
          acc.is_active
      );

    case 'in-source': // Where it comes from (Dari - Sumber Pendapatan)
      return accounts.filter(
        (acc) =>
          acc.account_type === 'REVENUE' &&
          acc.parent_account_id != null &&
          acc.is_active
      );

    case 'out-source': // Where money comes from (Bayar Dari) - Asset sub-accounts
      return accounts.filter(
        (acc) =>
          acc.account_type === 'ASSET' &&
          acc.parent_account_id != null &&
          acc.is_active
      );

    case 'out-destination': // What you're paying for (Untuk) - Expense sub-accounts
      return accounts.filter(
        (acc) =>
          acc.account_type === 'EXPENSE' &&
          acc.parent_account_id != null &&
          acc.is_active
      );

    default:
      return accounts;
  }
}

/**
 * Expense filter - simplified since users create their own sub-accounts
 */
export type ExpenseFilter = 'ALL';

export function filterExpensesByCategory(
  accounts: Account[],
  _category: ExpenseFilter
): Account[] {
  return accounts;
}

/**
 * Account code range constants for reference
 */
export const ACCOUNT_RANGES = {
  ASSET: { min: '1000', max: '1999' },
  LIABILITY: { min: '2000', max: '2999' },
  EQUITY: { min: '3000', max: '3999' },
  REVENUE: { min: '4000', max: '4999' },
  EXPENSE: { min: '5000', max: '5999' },
} as const;
