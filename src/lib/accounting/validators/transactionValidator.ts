/**
 * Transaction Validator
 * Validates transactions against double-entry bookkeeping rules
 */

import type { Account } from '@/types';
import type {
  ValidationResult,
  ValidationError,
  TransactionWithAccounts,
} from '../types';
import {
  isValidCombination,
  ERROR_MESSAGES,
  WARNING_MESSAGES,
} from '../constants';

export class TransactionValidator {
  /**
   * Validate a complete transaction
   * Returns validation result with errors/warnings in Indonesian
   */
  validate(input: TransactionWithAccounts): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // 1. Validate amount is positive
    if (input.amount <= 0) {
      errors.push({
        field: 'amount',
        code: 'INVALID_AMOUNT',
        message: ERROR_MESSAGES.INVALID_AMOUNT,
        severity: 'error',
      });
    }

    // 2. Validate debit and credit accounts are different
    if (input.debit_account_id === input.credit_account_id) {
      errors.push({
        field: 'debit_account_id',
        code: 'SAME_ACCOUNT',
        message: ERROR_MESSAGES.SAME_ACCOUNT,
        severity: 'error',
      });
    }

    // 3. Validate account combination makes sense
    const combinationResult = this.validateAccountCombination(
      input.debitAccount,
      input.creditAccount
    );
    errors.push(...combinationResult.errors);
    warnings.push(...combinationResult.warnings);

    // 4. Validate normal balance usage and add context-aware warnings
    const normalBalanceResult = this.validateNormalBalanceUsage(
      input.debitAccount,
      input.creditAccount
    );
    warnings.push(...normalBalanceResult.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate just the account IDs (without full account data)
   * Used for quick validation in forms
   */
  validateAccountIds(
    debitAccountId: string | undefined,
    creditAccountId: string | undefined
  ): ValidationResult {
    const errors: ValidationError[] = [];

    if (!debitAccountId) {
      errors.push({
        field: 'debit_account_id',
        code: 'MISSING_DEBIT_ACCOUNT',
        message: ERROR_MESSAGES.MISSING_DEBIT_ACCOUNT,
        severity: 'error',
      });
    }

    if (!creditAccountId) {
      errors.push({
        field: 'credit_account_id',
        code: 'MISSING_CREDIT_ACCOUNT',
        message: ERROR_MESSAGES.MISSING_CREDIT_ACCOUNT,
        severity: 'error',
      });
    }

    if (debitAccountId && creditAccountId && debitAccountId === creditAccountId) {
      errors.push({
        field: 'debit_account_id',
        code: 'SAME_ACCOUNT',
        message: ERROR_MESSAGES.SAME_ACCOUNT,
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Validate account combination follows accounting rules
   */
  private validateAccountCombination(
    debitAccount: Account,
    creditAccount: Account
  ): ValidationResult {
    const isValid = isValidCombination(
      debitAccount.account_type,
      creditAccount.account_type
    );

    if (!isValid) {
      return {
        isValid: false,
        errors: [
          {
            field: 'debit_account_id',
            code: 'INVALID_COMBINATION',
            message: `Kombinasi akun tidak valid: Debit "${debitAccount.account_name}" (${this.getAccountTypeLabel(debitAccount.account_type)}) dengan Kredit "${creditAccount.account_name}" (${this.getAccountTypeLabel(creditAccount.account_type)}). Periksa kembali jenis transaksi yang ingin dicatat.`,
            severity: 'error',
          },
        ],
        warnings: [],
      };
    }

    return { isValid: true, errors: [], warnings: [] };
  }

  /**
   * Check for unusual patterns and add warnings
   */
  private validateNormalBalanceUsage(
    debitAccount: Account,
    creditAccount: Account
  ): ValidationResult {
    const warnings: ValidationError[] = [];

    // Warning: Debit to Revenue (unusual - means revenue reversal)
    if (debitAccount.account_type === 'REVENUE') {
      warnings.push({
        field: 'debit_account_id',
        code: 'UNUSUAL_REVENUE_DEBIT',
        message: WARNING_MESSAGES.UNUSUAL_REVENUE_DEBIT,
        severity: 'warning',
      });
    }

    // Warning: Credit to Expense (unusual - means expense reversal)
    if (creditAccount.account_type === 'EXPENSE') {
      warnings.push({
        field: 'credit_account_id',
        code: 'UNUSUAL_EXPENSE_CREDIT',
        message: WARNING_MESSAGES.UNUSUAL_EXPENSE_CREDIT,
        severity: 'warning',
      });
    }

    return { isValid: true, errors: [], warnings };
  }

  /**
   * Get Indonesian label for account type
   */
  private getAccountTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      ASSET: 'Aset',
      LIABILITY: 'Liabilitas',
      EQUITY: 'Ekuitas',
      REVENUE: 'Pendapatan',
      EXPENSE: 'Beban',
    };
    return labels[type] || type;
  }
}

/**
 * Create a singleton validator instance
 */
export const transactionValidator = new TransactionValidator();
