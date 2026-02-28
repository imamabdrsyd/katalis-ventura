/**
 * Smart Resolver — Auto-resolve category, name, and accounts from transaction description
 */

import type { Account, TransactionCategory } from '@/types';
import { detectPatternFromName, TRANSACTION_PATTERNS } from '@/lib/accounting/guidance/transactionPatterns';
import type { TransactionPattern } from '@/lib/accounting/types';

export interface SmartResolveResult {
  category: TransactionCategory;
  name: string;
  debit_account_code: string;
  credit_account_code: string;
  debit_account_id: string;
  credit_account_id: string;
  pattern_id: string | null;
  confidence: 'high' | 'medium' | 'low';
  resolve_source: string;
}

/**
 * Map pattern ID to transaction category
 */
const PATTERN_TO_CATEGORY: Record<string, TransactionCategory> = {
  capital_injection: 'FIN',
  receive_revenue: 'EARN',
  receive_loan: 'FIN',
  pay_opex: 'OPEX',
  pay_variable_cost: 'VAR',
  buy_asset: 'CAPEX',
  pay_loan: 'FIN',
  pay_tax: 'TAX',
  owner_withdrawal: 'FIN',
  accrued_expense: 'OPEX',
  unearned_revenue_received: 'FIN',
  unearned_revenue_recognized: 'EARN',
  liability_reclassification: 'FIN',
  revenue_return: 'EARN',
  expense_reimbursement: 'OPEX',
};

/**
 * Default account codes per category (debit, credit)
 */
const CATEGORY_DEFAULT_ACCOUNTS: Record<TransactionCategory, { debitCodes: string[]; creditCodes: string[] }> = {
  EARN: { debitCodes: ['1200', '1100'], creditCodes: ['4100'] },
  OPEX: { debitCodes: ['5100'], creditCodes: ['1200', '1100'] },
  VAR: { debitCodes: ['5200', '5100'], creditCodes: ['1200', '1100'] },
  CAPEX: { debitCodes: ['1300'], creditCodes: ['1200', '1100'] },
  TAX: { debitCodes: ['5300', '5100'], creditCodes: ['1200', '1100'] },
  FIN: { debitCodes: ['3100'], creditCodes: ['1200', '1100'] },
};

/**
 * Keyword-based category fallback when no pattern matches
 */
const KEYWORD_CATEGORY_MAP: Array<{ keywords: string[]; category: TransactionCategory }> = [
  { keywords: ['pendapatan', 'pemasukan', 'revenue', 'income', 'penjualan', 'jual', 'terima pembayaran', 'fee jasa'], category: 'EARN' },
  { keywords: ['bayar', 'biaya', 'beban', 'expense', 'telepon', 'wifi', 'keamanan', 'sewa kantor', 'operasional'], category: 'OPEX' },
  { keywords: ['bahan baku', 'persediaan', 'stok', 'packaging', 'hpp', 'variabel'], category: 'VAR' },
  { keywords: ['renovasi', 'bangunan', 'perbaikan besar', 'investasi aset'], category: 'CAPEX' },
  { keywords: ['pajak', 'pph', 'pbb', 'ppn', 'retribusi', 'tax'], category: 'TAX' },
  { keywords: ['pinjaman', 'angsuran', 'bunga bank', 'transfer modal', 'modal', 'prive', 'cicilan'], category: 'FIN' },
];

/**
 * Find an account by code(s) or by account type from the business's chart of accounts
 */
function resolveAccount(
  suggestedCodes: string[],
  accountType: string,
  accounts: Account[]
): Account | null {
  // Try suggested codes first
  for (const code of suggestedCodes) {
    const match = accounts.find(
      (a) => a.account_code === code && a.is_active
    );
    if (match) return match;

    // Try prefix match (e.g. '1200' matches '1201', '1202')
    const prefixMatch = accounts.find(
      (a) => a.account_code.startsWith(code) && a.is_active
    );
    if (prefixMatch) return prefixMatch;
  }

  // Fallback: first active account of the right type
  return accounts.find((a) => a.account_type === accountType && a.is_active) || null;
}

/**
 * Extract a short name from description (first 3-5 meaningful words, max 50 chars)
 */
function extractName(description: string): string {
  const stopWords = ['di', 'ke', 'dari', 'untuk', 'dan', 'atau', 'yang', 'dengan', 'pada', 'oleh'];
  const words = description.trim().split(/\s+/);

  let name = '';
  let wordCount = 0;

  for (const word of words) {
    if (wordCount >= 4) break;
    if (name.length + word.length + 1 > 50) break;

    name += (name ? ' ' : '') + word;
    // Don't count stop words toward the limit
    if (!stopWords.includes(word.toLowerCase())) {
      wordCount++;
    }
  }

  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Detect category from description keywords (fallback when pattern not matched)
 */
function detectCategoryFromKeywords(description: string): TransactionCategory | null {
  const lower = description.toLowerCase();

  for (const entry of KEYWORD_CATEGORY_MAP) {
    for (const keyword of entry.keywords) {
      if (lower.includes(keyword)) {
        return entry.category;
      }
    }
  }

  return null;
}

/**
 * Main smart resolve function
 */
export function smartResolveTransaction(
  description: string,
  accounts: Account[]
): SmartResolveResult {
  const pattern = detectPatternFromName(description);

  if (pattern) {
    return resolveFromPattern(description, pattern, accounts);
  }

  // Fallback: keyword-based category detection
  const category = detectCategoryFromKeywords(description) || 'OPEX';
  return resolveFromCategory(description, category, accounts, category !== 'OPEX');
}

/**
 * Resolve from a matched pattern (high confidence)
 */
function resolveFromPattern(
  description: string,
  pattern: TransactionPattern,
  accounts: Account[]
): SmartResolveResult {
  const category = PATTERN_TO_CATEGORY[pattern.id] || 'OPEX';

  const debitAccount = resolveAccount(
    pattern.suggestedDebitCodes,
    pattern.debitAccountType,
    accounts
  );

  const creditAccount = resolveAccount(
    pattern.suggestedCreditCodes,
    pattern.creditAccountType,
    accounts
  );

  return {
    category,
    name: extractName(description),
    debit_account_code: debitAccount?.account_code || '',
    credit_account_code: creditAccount?.account_code || '',
    debit_account_id: debitAccount?.id || '',
    credit_account_id: creditAccount?.id || '',
    pattern_id: pattern.id,
    confidence: debitAccount && creditAccount ? 'high' : 'medium',
    resolve_source: `Pola: ${pattern.name}`,
  };
}

/**
 * Resolve from category fallback (medium/low confidence)
 */
function resolveFromCategory(
  description: string,
  category: TransactionCategory,
  accounts: Account[],
  hasKeywordMatch: boolean
): SmartResolveResult {
  const defaults = CATEGORY_DEFAULT_ACCOUNTS[category];

  // Map category to expected account types for debit/credit
  const categoryAccountTypes: Record<TransactionCategory, { debit: string; credit: string }> = {
    EARN: { debit: 'ASSET', credit: 'REVENUE' },
    OPEX: { debit: 'EXPENSE', credit: 'ASSET' },
    VAR: { debit: 'EXPENSE', credit: 'ASSET' },
    CAPEX: { debit: 'ASSET', credit: 'ASSET' },
    TAX: { debit: 'EXPENSE', credit: 'ASSET' },
    FIN: { debit: 'EQUITY', credit: 'ASSET' },
  };

  const types = categoryAccountTypes[category];

  const debitAccount = resolveAccount(defaults.debitCodes, types.debit, accounts);
  const creditAccount = resolveAccount(defaults.creditCodes, types.credit, accounts);

  return {
    category,
    name: extractName(description),
    debit_account_code: debitAccount?.account_code || '',
    credit_account_code: creditAccount?.account_code || '',
    debit_account_id: debitAccount?.id || '',
    credit_account_id: creditAccount?.id || '',
    pattern_id: null,
    confidence: hasKeywordMatch ? 'medium' : 'low',
    resolve_source: hasKeywordMatch ? `Keyword: ${category}` : 'Default: OPEX',
  };
}

/**
 * Batch resolve multiple rows
 */
export function smartResolveRows(
  rows: Array<{ description: string }>,
  accounts: Account[]
): SmartResolveResult[] {
  return rows.map((row) => smartResolveTransaction(row.description, accounts));
}
