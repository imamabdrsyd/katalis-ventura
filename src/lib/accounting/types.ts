/**
 * Type definitions for the Accounting Model layer
 * Provides validation and guidance for double-entry bookkeeping
 */

import type { Account, AccountType } from '@/types';

// ============================================
// Validation Result Types
// ============================================

export interface ValidationError {
  field: string;
  code: string;
  message: string; // Indonesian error message
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================
// Transaction Input Types
// ============================================

export interface TransactionInput {
  amount: number;
  debit_account_id: string;
  credit_account_id: string;
  date: string;
  name: string;
  description?: string;
}

export interface TransactionWithAccounts extends TransactionInput {
  debitAccount: Account;
  creditAccount: Account;
}

// ============================================
// Guidance Types
// ============================================

export interface TransactionPattern {
  id: string;
  name: string; // e.g., "Suntik Modal"
  description: string; // e.g., "Pemilik menambah modal ke bisnis"
  debitAccountType: AccountType;
  creditAccountType: AccountType;
  suggestedDebitCodes: string[]; // e.g., ['1110', '1120']
  suggestedCreditCodes: string[]; // e.g., ['3100']
  examples: string[]; // Example descriptions
}

export interface AccountSuggestion {
  account: Account;
  reason: string; // Why this account is suggested
  confidence: 'high' | 'medium' | 'low';
}

export interface TransactionGuidance {
  pattern: TransactionPattern | null;
  suggestedDebitAccounts: AccountSuggestion[];
  suggestedCreditAccounts: AccountSuggestion[];
  explanation: string; // What will happen to financial statements
  warnings: string[]; // Potential issues to be aware of
}

// ============================================
// Account Rules
// ============================================

export interface AccountRule {
  accountType: AccountType;
  normalBalance: 'DEBIT' | 'CREDIT';
  increasesOn: 'DEBIT' | 'CREDIT';
  decreasesOn: 'DEBIT' | 'CREDIT';
}

export type AccountRuleMap = Record<AccountType, AccountRule>;

// ============================================
// Valid Account Combinations
// ============================================

export interface AccountCombination {
  debit: AccountType[];
  credit: AccountType[];
  description: string;
}

// ============================================
// Financial Impact Analysis
// ============================================

export interface FinancialImpact {
  assetsChange: number;
  liabilitiesChange: number;
  equityChange: number;
  revenueChange: number;
  expenseChange: number;
  balanceSheetImpact: string; // Human-readable explanation
  incomeStatementImpact: string;
}
