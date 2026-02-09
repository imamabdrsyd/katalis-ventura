/**
 * Accounting constants and rules
 * Defines normal balances and valid account combinations
 */

import type { AccountType } from '@/types';
import type { AccountRuleMap, AccountCombination } from './types';

// ============================================
// Normal Balance Rules per Account Type
// ============================================

export const ACCOUNT_RULES: AccountRuleMap = {
  ASSET: {
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    increasesOn: 'DEBIT',
    decreasesOn: 'CREDIT',
  },
  LIABILITY: {
    accountType: 'LIABILITY',
    normalBalance: 'CREDIT',
    increasesOn: 'CREDIT',
    decreasesOn: 'DEBIT',
  },
  EQUITY: {
    accountType: 'EQUITY',
    normalBalance: 'CREDIT',
    increasesOn: 'CREDIT',
    decreasesOn: 'DEBIT',
  },
  REVENUE: {
    accountType: 'REVENUE',
    normalBalance: 'CREDIT',
    increasesOn: 'CREDIT',
    decreasesOn: 'DEBIT',
  },
  EXPENSE: {
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    increasesOn: 'DEBIT',
    decreasesOn: 'CREDIT',
  },
};

// ============================================
// Valid Account Type Combinations
// ============================================

export const VALID_COMBINATIONS: AccountCombination[] = [
  // Money IN patterns
  {
    debit: ['ASSET'],
    credit: ['REVENUE'],
    description: 'Pendapatan masuk ke kas/bank',
  },
  {
    debit: ['ASSET'],
    credit: ['EQUITY'],
    description: 'Suntik modal ke kas/bank',
  },
  {
    debit: ['ASSET'],
    credit: ['LIABILITY'],
    description: 'Terima pinjaman ke kas/bank',
  },
  // Money OUT patterns
  {
    debit: ['EXPENSE'],
    credit: ['ASSET'],
    description: 'Bayar beban dari kas/bank',
  },
  {
    debit: ['ASSET'],
    credit: ['ASSET'],
    description: 'Transfer antar aset (beli properti, pindah rekening)',
  },
  {
    debit: ['LIABILITY'],
    credit: ['ASSET'],
    description: 'Bayar hutang dari kas/bank',
  },
  {
    debit: ['EQUITY'],
    credit: ['ASSET'],
    description: 'Penarikan modal (prive) dari kas/bank',
  },
  // Revenue adjustments
  {
    debit: ['REVENUE'],
    credit: ['ASSET'],
    description: 'Retur penjualan / koreksi pendapatan',
  },
  // Expense adjustments
  {
    debit: ['ASSET'],
    credit: ['EXPENSE'],
    description: 'Penggantian biaya / koreksi beban',
  },
  // Liability to Equity (rare but valid)
  {
    debit: ['LIABILITY'],
    credit: ['EQUITY'],
    description: 'Konversi hutang menjadi modal',
  },
];

// ============================================
// Error Codes and Messages (Indonesian)
// ============================================

export const ERROR_MESSAGES: Record<string, string> = {
  INVALID_AMOUNT: 'Jumlah transaksi harus lebih dari 0',
  SAME_ACCOUNT: 'Akun debit dan kredit tidak boleh sama. Transaksi harus melibatkan minimal dua akun yang berbeda.',
  INVALID_COMBINATION: 'Kombinasi akun tidak sesuai dengan aturan akuntansi. Silakan periksa kembali jenis transaksi yang ingin dicatat.',
  ACCOUNT_NOT_FOUND: 'Akun tidak ditemukan. Pastikan akun yang dipilih masih aktif.',
  MISSING_DEBIT_ACCOUNT: 'Akun debit harus dipilih',
  MISSING_CREDIT_ACCOUNT: 'Akun kredit harus dipilih',
};

// ============================================
// Warning Messages (Indonesian)
// ============================================

export const WARNING_MESSAGES: Record<string, string> = {
  UNUSUAL_REVENUE_DEBIT:
    'Perhatian: Mendebit akun pendapatan akan mengurangi pendapatan. Ini biasanya untuk koreksi atau retur penjualan. Apakah ini yang Anda maksud?',
  UNUSUAL_EXPENSE_CREDIT:
    'Perhatian: Mengkredit akun beban akan mengurangi beban. Ini biasanya untuk koreksi atau penggantian biaya. Apakah ini yang Anda maksud?',
  CAPITAL_AS_REVENUE:
    'Perhatian: Jika ini adalah setoran modal dari pemilik, gunakan akun Modal (Equity), bukan Pendapatan (Revenue).',
  WITHDRAWAL_AS_EXPENSE:
    'Perhatian: Jika ini adalah penarikan pribadi pemilik, gunakan akun Prive (Equity), bukan Beban (Expense).',
};

// ============================================
// Helper Functions
// ============================================

/**
 * Check if an account type combination is valid
 */
export function isValidCombination(
  debitType: AccountType,
  creditType: AccountType
): boolean {
  return VALID_COMBINATIONS.some(
    (combo) =>
      combo.debit.includes(debitType) && combo.credit.includes(creditType)
  );
}

/**
 * Get description for an account combination
 */
export function getCombinationDescription(
  debitType: AccountType,
  creditType: AccountType
): string | null {
  const combo = VALID_COMBINATIONS.find(
    (c) => c.debit.includes(debitType) && c.credit.includes(creditType)
  );
  return combo?.description || null;
}

/**
 * Get account rule by type
 */
export function getAccountRule(accountType: AccountType) {
  return ACCOUNT_RULES[accountType];
}
