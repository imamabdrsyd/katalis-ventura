/**
 * Transaction Guidance Service
 * Provides smart suggestions and explanations for transactions
 */

import type { Account } from '@/types';
import type {
  TransactionPattern,
  TransactionGuidance,
  AccountSuggestion,
} from '../types';
import { ACCOUNT_RULES, getCombinationDescription } from '../constants';
import {
  TRANSACTION_PATTERNS,
  findMatchingPatterns,
  detectPatternFromName,
} from './transactionPatterns';

export class TransactionGuidanceService {
  private accounts: Account[];

  constructor(accounts: Account[]) {
    this.accounts = accounts;
  }

  /**
   * Detect pattern based on user's partial input
   */
  detectPattern(
    debitAccountId?: string,
    creditAccountId?: string,
    transactionName?: string
  ): TransactionPattern | null {
    // First, try to detect from name if provided
    if (transactionName && transactionName.length > 2) {
      const patternFromName = detectPatternFromName(transactionName);
      if (patternFromName) {
        return patternFromName;
      }
    }

    // If both accounts selected, find matching pattern
    if (debitAccountId && creditAccountId) {
      const debitAccount = this.accounts.find((a) => a.id === debitAccountId);
      const creditAccount = this.accounts.find((a) => a.id === creditAccountId);

      if (debitAccount && creditAccount) {
        const matchingPatterns = findMatchingPatterns(
          debitAccount.account_type,
          creditAccount.account_type
        );

        if (matchingPatterns.length > 0) {
          // Return the first matching pattern (most common case)
          return matchingPatterns[0];
        }
      }
    }

    return null;
  }

  /**
   * Get account suggestions based on detected pattern
   */
  getSuggestedAccounts(
    pattern: TransactionPattern,
    accountRole: 'debit' | 'credit'
  ): AccountSuggestion[] {
    const suggestedCodes =
      accountRole === 'debit'
        ? pattern.suggestedDebitCodes
        : pattern.suggestedCreditCodes;

    const suggestions: AccountSuggestion[] = [];

    // First, add exact matches from suggested codes
    for (const code of suggestedCodes) {
      const account = this.accounts.find(
        (a) => a.account_code === code && a.is_active
      );
      if (account) {
        suggestions.push({
          account,
          reason: `Cocok untuk transaksi "${pattern.name}"`,
          confidence: 'high',
        });
      }
    }

    // Then, add accounts of the correct type that aren't already suggested
    const targetType =
      accountRole === 'debit'
        ? pattern.debitAccountType
        : pattern.creditAccountType;

    const additionalAccounts = this.accounts.filter(
      (a) =>
        a.account_type === targetType &&
        a.is_active &&
        !suggestions.some((s) => s.account.id === a.id)
    );

    for (const account of additionalAccounts.slice(0, 3)) {
      suggestions.push({
        account,
        reason: `Tipe akun ${this.getAccountTypeLabel(targetType)} yang tersedia`,
        confidence: 'medium',
      });
    }

    return suggestions;
  }

  /**
   * Get full guidance for a transaction
   */
  getGuidance(
    debitAccountId?: string,
    creditAccountId?: string,
    transactionName?: string
  ): TransactionGuidance {
    const pattern = this.detectPattern(
      debitAccountId,
      creditAccountId,
      transactionName
    );

    // If no pattern detected, return minimal guidance
    if (!pattern) {
      // Check if we can still provide some guidance based on selected accounts
      if (debitAccountId || creditAccountId) {
        return this.getBasicGuidance(debitAccountId, creditAccountId);
      }

      return {
        pattern: null,
        suggestedDebitAccounts: [],
        suggestedCreditAccounts: [],
        explanation:
          'Pilih akun debit dan kredit untuk melihat penjelasan transaksi.',
        warnings: [],
      };
    }

    const debitSuggestions = this.getSuggestedAccounts(pattern, 'debit');
    const creditSuggestions = this.getSuggestedAccounts(pattern, 'credit');

    return {
      pattern,
      suggestedDebitAccounts: debitSuggestions,
      suggestedCreditAccounts: creditSuggestions,
      explanation: this.generateExplanation(
        pattern,
        debitAccountId,
        creditAccountId
      ),
      warnings: this.generateWarnings(pattern, debitAccountId, creditAccountId),
    };
  }

  /**
   * Get basic guidance when no pattern is detected but accounts are selected
   */
  private getBasicGuidance(
    debitAccountId?: string,
    creditAccountId?: string
  ): TransactionGuidance {
    const debitAccount = debitAccountId
      ? this.accounts.find((a) => a.id === debitAccountId)
      : null;
    const creditAccount = creditAccountId
      ? this.accounts.find((a) => a.id === creditAccountId)
      : null;

    let explanation = '';

    if (debitAccount && creditAccount) {
      const description = getCombinationDescription(
        debitAccount.account_type,
        creditAccount.account_type
      );

      if (description) {
        explanation = `**Jenis Transaksi**: ${description}\n\n`;
      }

      explanation += `Transaksi ini akan:\n`;
      explanation += `• ${this.getImpactDescription(debitAccount, 'debit')}\n`;
      explanation += `• ${this.getImpactDescription(creditAccount, 'credit')}`;
    } else if (debitAccount) {
      explanation = `Akun debit dipilih: ${debitAccount.account_name} (${this.getAccountTypeLabel(debitAccount.account_type)}).\nPilih akun kredit untuk melengkapi transaksi.`;
    } else if (creditAccount) {
      explanation = `Akun kredit dipilih: ${creditAccount.account_name} (${this.getAccountTypeLabel(creditAccount.account_type)}).\nPilih akun debit untuk melengkapi transaksi.`;
    }

    return {
      pattern: null,
      suggestedDebitAccounts: [],
      suggestedCreditAccounts: [],
      explanation,
      warnings: [],
    };
  }

  /**
   * Generate explanation for a transaction
   */
  private generateExplanation(
    pattern: TransactionPattern,
    debitAccountId?: string,
    creditAccountId?: string
  ): string {
    const debitAccount = debitAccountId
      ? this.accounts.find((a) => a.id === debitAccountId)
      : null;
    const creditAccount = creditAccountId
      ? this.accounts.find((a) => a.id === creditAccountId)
      : null;

    let explanation = `**${pattern.name}**\n${pattern.description}\n\n`;

    if (debitAccount && creditAccount) {
      explanation += `**Dampak Transaksi:**\n`;
      explanation += `• ${this.getImpactDescription(debitAccount, 'debit')}\n`;
      explanation += `• ${this.getImpactDescription(creditAccount, 'credit')}\n\n`;

      // Add balance sheet impact
      explanation += this.getBalanceSheetImpact(pattern);
    } else {
      explanation += `**Contoh:**\n`;
      explanation += pattern.examples
        .slice(0, 3)
        .map((e) => `• ${e}`)
        .join('\n');
    }

    return explanation;
  }

  /**
   * Get impact description for an account
   */
  private getImpactDescription(
    account: Account,
    position: 'debit' | 'credit'
  ): string {
    const rule = ACCOUNT_RULES[account.account_type];
    const isIncrease =
      (position === 'debit' && rule.increasesOn === 'DEBIT') ||
      (position === 'credit' && rule.increasesOn === 'CREDIT');

    const action = isIncrease ? 'Bertambah' : 'Berkurang';
    const icon = isIncrease ? '↑' : '↓';

    return `${account.account_name} ${icon} ${action}`;
  }

  /**
   * Get balance sheet impact explanation
   */
  private getBalanceSheetImpact(pattern: TransactionPattern): string {
    const debitType = pattern.debitAccountType;
    const creditType = pattern.creditAccountType;

    // Same type transfer
    if (debitType === creditType) {
      if (debitType === 'ASSET') {
        return '**Dampak ke Neraca:** Komposisi aset berubah, total aset tetap.';
      }
      return '**Dampak ke Neraca:** Tidak ada perubahan total.';
    }

    // Asset increases
    if (debitType === 'ASSET' && creditType === 'EQUITY') {
      return '**Dampak ke Neraca:** Total Aset ↑, Ekuitas ↑. Neraca tetap seimbang.';
    }
    if (debitType === 'ASSET' && creditType === 'LIABILITY') {
      return '**Dampak ke Neraca:** Total Aset ↑, Liabilitas ↑. Neraca tetap seimbang.';
    }
    if (debitType === 'ASSET' && creditType === 'REVENUE') {
      return '**Dampak ke Laba Rugi:** Pendapatan ↑ → Laba bersih ↑ → Ekuitas ↑.';
    }

    // Asset decreases
    if (debitType === 'EXPENSE' && creditType === 'ASSET') {
      return '**Dampak ke Laba Rugi:** Beban ↑ → Laba bersih ↓ → Ekuitas ↓.';
    }
    if (debitType === 'LIABILITY' && creditType === 'ASSET') {
      return '**Dampak ke Neraca:** Total Aset ↓, Liabilitas ↓. Neraca tetap seimbang.';
    }
    if (debitType === 'EQUITY' && creditType === 'ASSET') {
      return '**Dampak ke Neraca:** Total Aset ↓, Ekuitas ↓. Neraca tetap seimbang.';
    }

    return '';
  }

  /**
   * Generate warnings for potential issues
   */
  private generateWarnings(
    pattern: TransactionPattern,
    debitAccountId?: string,
    creditAccountId?: string
  ): string[] {
    const warnings: string[] = [];

    const creditAccount = creditAccountId
      ? this.accounts.find((a) => a.id === creditAccountId)
      : null;
    const debitAccount = debitAccountId
      ? this.accounts.find((a) => a.id === debitAccountId)
      : null;

    // Warning: Using Revenue when it should be Equity (capital injection)
    if (
      pattern.id === 'receive_revenue' &&
      creditAccount?.account_type === 'EQUITY'
    ) {
      warnings.push(
        'Anda memilih akun Ekuitas sebagai kredit. Jika ini adalah setoran modal pemilik, pastikan ini memang yang Anda maksud (bukan pendapatan usaha).'
      );
    }

    // Warning: Using Equity type when recording revenue
    if (
      pattern.id === 'receive_revenue' &&
      creditAccount?.account_type === 'EQUITY' &&
      creditAccount.account_name.toLowerCase().includes('modal')
    ) {
      warnings.push(
        'Akun Modal Pemilik dipilih sebagai kredit. Jika ini pembayaran dari customer, gunakan akun Pendapatan (4xxx) bukan Modal.'
      );
    }

    // Warning: Using Equity type (owner withdrawal/prive) in operating expenses
    if (
      pattern.id === 'pay_opex' &&
      debitAccount?.account_type === 'EQUITY' &&
      (debitAccount.account_name.toLowerCase().includes('prive') ||
       debitAccount.account_name.toLowerCase().includes('drawing'))
    ) {
      warnings.push(
        'Akun Prive dipilih sebagai debit. Ini berarti penarikan oleh pemilik, bukan biaya operasional bisnis.'
      );
    }

    return warnings;
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
