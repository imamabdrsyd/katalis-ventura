'use client';

import { useMemo } from 'react';
import type { Account } from '@/types';
import {
  TransactionGuidanceService,
  TransactionValidator,
  type ValidationResult,
  type TransactionGuidance,
} from '@/lib/accounting';

interface UseAccountingGuidanceParams {
  debitAccountId?: string;
  creditAccountId?: string;
  amount: number;
  transactionName?: string;
  accounts: Account[];
}

interface UseAccountingGuidanceReturn {
  guidance: TransactionGuidance;
  validation: ValidationResult;
  isValid: boolean;
  hasWarnings: boolean;
}

/**
 * Hook for real-time accounting guidance and validation
 * Used in TransactionForm to provide smart suggestions and validate input
 */
export function useAccountingGuidance(
  params: UseAccountingGuidanceParams
): UseAccountingGuidanceReturn {
  const { debitAccountId, creditAccountId, amount, transactionName, accounts } =
    params;

  // Create guidance service instance
  const guidanceService = useMemo(
    () => new TransactionGuidanceService(accounts),
    [accounts]
  );

  // Create validator instance
  const validator = useMemo(() => new TransactionValidator(), []);

  // Get guidance based on current input
  const guidance = useMemo(
    () =>
      guidanceService.getGuidance(
        debitAccountId,
        creditAccountId,
        transactionName
      ),
    [guidanceService, debitAccountId, creditAccountId, transactionName]
  );

  // Validate current input
  const validation = useMemo(() => {
    // If no accounts selected yet, return valid (no validation needed)
    if (!debitAccountId && !creditAccountId) {
      return { isValid: true, errors: [], warnings: [] };
    }

    // If only one account selected, do basic validation
    if (!debitAccountId || !creditAccountId) {
      return validator.validateAccountIds(debitAccountId, creditAccountId);
    }

    // Find full account objects
    const debitAccount = accounts.find((a) => a.id === debitAccountId);
    const creditAccount = accounts.find((a) => a.id === creditAccountId);

    // If accounts not found, return error
    if (!debitAccount || !creditAccount) {
      return {
        isValid: false,
        errors: [
          {
            field: 'account',
            code: 'ACCOUNT_NOT_FOUND',
            message: 'Akun tidak ditemukan. Pastikan akun yang dipilih masih aktif.',
            severity: 'error' as const,
          },
        ],
        warnings: [],
      };
    }

    // Full validation
    return validator.validate({
      amount,
      debit_account_id: debitAccountId,
      credit_account_id: creditAccountId,
      date: new Date().toISOString().split('T')[0],
      name: transactionName || '',
      debitAccount,
      creditAccount,
    });
  }, [
    validator,
    accounts,
    debitAccountId,
    creditAccountId,
    amount,
    transactionName,
  ]);

  return {
    guidance,
    validation,
    isValid: validation.isValid,
    hasWarnings: validation.warnings.length > 0,
  };
}
