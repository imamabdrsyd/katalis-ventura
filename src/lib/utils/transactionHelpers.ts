import type { TransactionCategory, Account } from '@/types';

/**
 * Auto-detect transaction category based on debit and credit account codes
 * This enables hiding the category dropdown from users while maintaining proper categorization
 */
export function detectCategory(
  debitAccountCode: string,
  creditAccountCode: string
): TransactionCategory {
  // Money IN flow: Bank debit (asset increase), Revenue credit
  if (debitAccountCode >= '1110' && debitAccountCode <= '1132') {
    if (creditAccountCode >= '4000' && creditAccountCode <= '4999') {
      return 'EARN'; // Revenue → Bank
    }
    if (creditAccountCode >= '2000' && creditAccountCode <= '2999') {
      return 'FIN'; // Loan received → Bank
    }
  }

  // Money OUT flow: Asset credit (paying from bank/cash)
  if (creditAccountCode >= '1110' && creditAccountCode <= '1132') {
    const debitPrefix = debitAccountCode.substring(0, 2);

    // Expense accounts categorization by code range
    if (debitPrefix === '51') return 'OPEX'; // 5100-5199
    if (debitPrefix === '52') return 'VAR'; // 5200-5299
    if (debitPrefix === '53') return 'TAX'; // 5300-5399
    if (debitPrefix === '54') return 'FIN'; // 5400-5499

    // Special: Fixed asset purchase (CAPEX)
    if (debitAccountCode >= '1200' && debitAccountCode <= '1299') {
      return 'CAPEX';
    }

    // Special: Owner withdrawal
    if (debitAccountCode === '3300') {
      return 'FIN';
    }

    // Special: Liability payment
    if (debitAccountCode >= '2000' && debitAccountCode <= '2999') {
      return 'FIN';
    }
  }

  // Default fallback
  return 'OPEX';
}

/**
 * Filter accounts based on transaction mode and role
 * Reduces cognitive load by showing only relevant accounts
 */
export type FilterMode = 'in-destination' | 'in-source' | 'out-source' | 'out-destination' | null;

export function filterAccountsByMode(
  accounts: Account[],
  mode: FilterMode
): Account[] {
  if (!mode) return accounts; // No filter for 'full' mode

  switch (mode) {
    case 'in-destination': // Where money goes (Uang Masuk Ke)
      return accounts.filter(
        (acc) =>
          acc.account_code >= '1110' &&
          acc.account_code <= '1132' &&
          acc.is_active
      );

    case 'in-source': // Where it comes from (Dari - Sumber Pendapatan)
      return accounts.filter(
        (acc) => acc.account_type === 'REVENUE' && acc.is_active
      );

    case 'out-source': // Where money comes from (Bayar Dari)
      return accounts.filter(
        (acc) =>
          acc.account_code >= '1110' &&
          acc.account_code <= '1132' &&
          acc.is_active
      );

    case 'out-destination': // What you're paying for (Untuk)
      return accounts.filter(
        (acc) => acc.account_type === 'EXPENSE' && acc.is_active
      );

    default:
      return accounts;
  }
}

/**
 * Further filter expense accounts by quick category tabs (OPEX/VAR/TAX)
 */
export type ExpenseFilter = 'OPEX' | 'VAR' | 'TAX' | 'ALL';

export function filterExpensesByCategory(
  accounts: Account[],
  category: ExpenseFilter
): Account[] {
  if (category === 'ALL') return accounts;

  return accounts.filter((acc) => {
    const code = acc.account_code;
    switch (category) {
      case 'OPEX':
        return code >= '5100' && code <= '5199';
      case 'VAR':
        return code >= '5200' && code <= '5299';
      case 'TAX':
        return code >= '5300' && code <= '5399';
      default:
        return true;
    }
  });
}

/**
 * Account code range constants for reference
 */
export const ACCOUNT_RANGES = {
  CASH_AND_BANK: { min: '1110', max: '1132' },
  FIXED_ASSETS: { min: '1200', max: '1299' },
  LIABILITIES: { min: '2000', max: '2999' },
  OWNER_DRAWINGS: '3300',
  REVENUE: { min: '4000', max: '4999' },
  OPEX: { min: '5100', max: '5199' },
  VAR: { min: '5200', max: '5299' },
  TAX: { min: '5300', max: '5399' },
  FIN: { min: '5400', max: '5499' },
} as const;
