/**
 * Accounting Model Layer
 * Centralized accounting logic with validation and guidance
 */

// Types
export type {
  ValidationError,
  ValidationResult,
  TransactionInput,
  TransactionWithAccounts,
  TransactionPattern,
  AccountSuggestion,
  TransactionGuidance,
  AccountRule,
  AccountRuleMap,
  AccountCombination,
  FinancialImpact,
} from './types';

// Constants and Rules
export {
  ACCOUNT_RULES,
  VALID_COMBINATIONS,
  ERROR_MESSAGES,
  WARNING_MESSAGES,
  isValidCombination,
  getCombinationDescription,
  getAccountRule,
} from './constants';

// Validators
export { TransactionValidator, transactionValidator } from './validators';

// Guidance
export {
  TransactionGuidanceService,
  TRANSACTION_PATTERNS,
  getPatternById,
  findMatchingPatterns,
  detectPatternFromName,
} from './guidance';
