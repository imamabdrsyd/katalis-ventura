import type {
  Transaction,
  TransactionCategory,
  FinancialSummary,
  IncomeStatementMetrics,
  MonthlyData,
  BalanceSheetData,
  CashFlowData,
  CashFlowTransaction,
  Account,
  BudgetLine,
  Budget,
  BudgetVsActualRow,
  BudgetSummaryKPI,
  ProjectedMonth,
} from '@/types';
import { calculateDepreciationSummary } from '@/lib/accounting/depreciation';

// Helpers

/**
 * Heuristic: classify legacy FIN transactions by keyword analysis.
 * Legacy transactions don't have debit/credit accounts, so we rely on keywords
 * to determine whether FIN is: equity, liability, expense (interest), or cash-out.
 */
type LegacyFinType = 'equity' | 'liability_in' | 'liability_out' | 'interest' | 'unknown';

function classifyLegacyFin(name: string, description: string): LegacyFinType {
  const text = `${name} ${description}`.toLowerCase();

  // Interest / beban bunga → expense (income statement)
  if (
    text.includes('bunga') ||
    text.includes('interest') ||
    text.includes('beban bunga')
  ) {
    return 'interest';
  }

  // Capital injection / equity
  if (
    text.includes('modal') ||
    text.includes('setoran') ||
    text.includes('investasi pemilik') ||
    text.includes('injeksi')
  ) {
    return 'equity';
  }

  // Owner withdrawal / prive → equity out (cash out)
  if (
    text.includes('prive') ||
    text.includes('dividen') ||
    text.includes('penarikan pemilik') ||
    text.includes('pribadi')
  ) {
    return 'liability_out'; // treated as cash-out for opening balance
  }

  // Loan repayment / cicilan → liability reduction (cash out)
  if (
    text.includes('cicilan') ||
    text.includes('pelunasan') ||
    text.includes('bayar hutang') ||
    text.includes('angsuran') ||
    text.includes('bayar pinjaman')
  ) {
    return 'liability_out';
  }

  // Loan received / pinjaman masuk → liability increase (cash in)
  if (
    text.includes('pinjaman') ||
    text.includes('kredit') ||
    text.includes('kpr') ||
    text.includes('terima pinjaman')
  ) {
    return 'liability_in';
  }

  return 'unknown';
}

/** Backward-compat wrapper — checks if legacy FIN is interest */
function isInterestKeyword(name: string, description: string): boolean {
  return classifyLegacyFin(name, description) === 'interest';
}

// Constants
export const CAPITAL = 350_000_000; // Default capital investment (fallback only)

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  EARN: 'Revenue',
  OPEX: 'Operating Expenses',
  VAR: 'Variable Costs',
  CAPEX: 'Capital Expenditure',
  TAX: 'Taxes',
  FIN: 'Financing',
};

export const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  EARN: '#059669', // emerald
  OPEX: '#dc2626', // red
  VAR: '#db2777', // pink
  CAPEX: '#2563eb', // blue
  TAX: '#ca8a04', // yellow
  FIN: '#4f46e5', // indigo
};

/**
 * Resolve apakah sebuah expense account harus diklasifikasikan sebagai
 * Cost of Revenue (VAR) atau Operating Expense (OPEX) di Income Statement.
 *
 * Logic:
 *   1. Jika account.income_statement_section di-set → pakai override user
 *   2. Jika tidak → fallback ke default: default_category === 'VAR' → COGS
 *
 * Hanya relevan untuk EXPENSE account yang bukan TAX/FIN (interest).
 */
function resolveExpenseSection(
  account: Account | { default_category?: TransactionCategory; income_statement_section?: 'cost_of_revenue' | 'operating_expense' | null } | null | undefined
): 'cost_of_revenue' | 'operating_expense' {
  const override = account?.income_statement_section;
  if (override === 'cost_of_revenue') return 'cost_of_revenue';
  if (override === 'operating_expense') return 'operating_expense';
  return account?.default_category === 'VAR' ? 'cost_of_revenue' : 'operating_expense';
}

// Calculate financial summary from transactions
export function calculateFinancialSummary(
  transactions: Transaction[]
): FinancialSummary {
  const summary: FinancialSummary = {
    totalEarn: 0,
    totalOpex: 0,
    totalVar: 0,
    totalCapex: 0,
    totalTax: 0,
    totalFin: 0,
    totalInterest: 0,
    totalDepreciation: 0, // Set by hooks via applyDepreciationToSummary()
    netProfit: 0,
    grossProfit: 0,
  };

  transactions.forEach((t) => {
    const amount = Number(t.amount);

    // --- Multi-line journal entry path ---
    if (t.is_multi_line && t.journal_lines && t.journal_lines.length > 0) {
      // totalFin and totalCapex use transaction.amount for display/category tracking
      if (t.category === 'FIN') summary.totalFin += amount;
      if (t.category === 'CAPEX') summary.totalCapex += amount;

      // Income statement lines derived directly from journal_lines
      for (const line of t.journal_lines) {
        const acc = line.account;
        if (!acc) continue;

        if (line.debit_amount > 0) {
          if (acc.account_type === 'EXPENSE') {
            const cat = acc.default_category;
            if (cat === 'TAX') {
              summary.totalTax += line.debit_amount;
            } else if (t.category === 'FIN') {
              // Interest: FIN category with EXPENSE debit line — tidak masuk COGS/OPEX
              summary.totalInterest += line.debit_amount;
            } else {
              // Resolve via override; fallback default_category === 'VAR' → COGS
              const section = resolveExpenseSection(acc);
              if (section === 'cost_of_revenue') {
                summary.totalVar += line.debit_amount;
              } else {
                summary.totalOpex += line.debit_amount;
              }
            }
          } else if (acc.account_type === 'REVENUE') {
            // Debit to REVENUE = contra-revenue (sales return)
            summary.totalEarn -= line.debit_amount;
          }
        }

        if (line.credit_amount > 0 && acc.account_type === 'REVENUE') {
          summary.totalEarn += line.credit_amount;
        }
      }
      return; // skip the switch below
    }

    // --- Simple double-entry and legacy path ---
    switch (t.category) {
      case 'EARN':
        // For double-entry: only count if credit account is REVENUE type.
        // Settlement entries (Dr Kas / Cr Piutang) are ASSET-to-ASSET — no revenue recognized.
        // This catches both manual journal entries and button-based settlements.
        if (t.is_double_entry && t.credit_account?.account_type !== 'REVENUE') break;
        summary.totalEarn += amount;
        break;
      case 'OPEX': {
        // Respect override if debit account has income_statement_section set
        if (t.is_double_entry && t.debit_account?.account_type === 'EXPENSE') {
          const section = resolveExpenseSection(t.debit_account);
          if (section === 'cost_of_revenue') {
            summary.totalVar += amount;
          } else {
            summary.totalOpex += amount;
          }
        } else {
          summary.totalOpex += amount;
        }
        break;
      }
      case 'VAR':
        // For double-entry: only count as COGS if debit account is EXPENSE type
        // If debit is ASSET (inventory purchase), it's not COGS yet — still on balance sheet
        if (t.is_double_entry && t.debit_account?.account_type === 'ASSET') {
          // Inventory purchase — skip from income statement COGS
          break;
        }
        // Respect override: user may reclassify VAR account to Operating Expense
        if (t.is_double_entry && t.debit_account?.account_type === 'EXPENSE') {
          const section = resolveExpenseSection(t.debit_account);
          if (section === 'operating_expense') {
            summary.totalOpex += amount;
          } else {
            summary.totalVar += amount;
          }
        } else {
          summary.totalVar += amount;
        }
        break;
      case 'CAPEX':
        summary.totalCapex += amount;
        break;
      case 'TAX':
        summary.totalTax += amount;
        break;
      case 'FIN':
        summary.totalFin += amount;
        // Only count FIN as interest expense if it debits an EXPENSE account
        // (interest payments). FIN that touches EQUITY/LIABILITY (capital injection,
        // loan received, loan repayment) should NOT be in income statement.
        if (t.is_double_entry && t.debit_account?.account_type === 'EXPENSE') {
          summary.totalInterest += amount;
        }
        // For legacy transactions, only count as interest if name/description
        // contains interest-related keywords. Not all FIN is interest — it can be
        // capital injection, loan received, loan repayment, etc.
        if (!t.is_double_entry && isInterestKeyword(t.name, t.description)) {
          summary.totalInterest += amount;
        }
        break;
    }
  });

  summary.grossProfit = summary.totalEarn - summary.totalVar;
  summary.netProfit =
    summary.totalEarn -
    summary.totalOpex -
    summary.totalVar -
    summary.totalTax -
    summary.totalInterest; // Use totalInterest instead of totalFin

  return summary;
}

export interface InvestedCapitalMetrics {
  grossInvestedCapital: number;
  remainingInvestedCapital: number;
  capitalInjections: number;
  ownerWithdrawals: number;
}

function isStockAccount(account?: Account | null): boolean {
  return account?.account_type === 'EQUITY' && account.is_stock === true;
}

function isOwnerWithdrawalAccount(account?: Account | null): boolean {
  return account?.account_type === 'EQUITY' && (account.is_stock === true || account.is_dividend === true);
}

function looksLikeInitialCapitalTransaction(t: Transaction): boolean {
  const text = `${t.name ?? ''} ${t.description ?? ''} ${t.notes ?? ''}`.toLowerCase();
  return (
    text.includes('modal investasi awal') ||
    text.includes('modal awal') ||
    text.includes('owner capital') ||
    text.includes("owner's capital")
  );
}

/**
 * Calculate owner/investor capital used by ROI.
 *
 * Gross invested capital = all credits to EQUITY accounts marked is_stock.
 * Remaining invested capital = gross stock injections minus owner withdrawals
 * from stock/dividend equity accounts.
 *
 * Legacy/setup fallback: add businesses.capital_investment unless the same
 * initial capital already exists as a posted stock transaction.
 */
export function calculateInvestedCapital(
  transactions: Transaction[],
  fallbackCapital: number = 0
): InvestedCapitalMetrics {
  let capitalInjections = 0;
  let ownerWithdrawals = 0;
  let hasFallbackCapitalTransaction = false;
  const normalizedFallbackCapital = Math.max(0, Number(fallbackCapital) || 0);

  for (const t of transactions) {
    if (t.deleted_at) continue;

    if (t.is_multi_line && t.journal_lines && t.journal_lines.length > 0) {
      let transactionStockCredit = 0;
      for (const line of t.journal_lines) {
        const acc = line.account;
        if (isStockAccount(acc)) {
          const credit = Number(line.credit_amount || 0);
          transactionStockCredit += credit;
          capitalInjections += credit;
        }
        if (isOwnerWithdrawalAccount(acc)) {
          ownerWithdrawals += Number(line.debit_amount || 0);
        }
      }
      if (
        normalizedFallbackCapital > 0 &&
        looksLikeInitialCapitalTransaction(t) &&
        Math.abs(transactionStockCredit - normalizedFallbackCapital) < 0.01
      ) {
        hasFallbackCapitalTransaction = true;
      }
      continue;
    }

    const amount = Number(t.amount);
    if (isStockAccount(t.credit_account)) {
      capitalInjections += amount;
      if (
        normalizedFallbackCapital > 0 &&
        looksLikeInitialCapitalTransaction(t) &&
        Math.abs(amount - normalizedFallbackCapital) < 0.01
      ) {
        hasFallbackCapitalTransaction = true;
      }
    }
    if (isOwnerWithdrawalAccount(t.debit_account)) {
      ownerWithdrawals += amount;
    }
  }

  const fallbackContribution =
    normalizedFallbackCapital > 0 && !hasFallbackCapitalTransaction
      ? normalizedFallbackCapital
      : 0;
  const grossInvestedCapital = capitalInjections + fallbackContribution;
  const remainingInvestedCapital = Math.max(0, grossInvestedCapital - ownerWithdrawals);

  return {
    grossInvestedCapital,
    remainingInvestedCapital,
    capitalInjections,
    ownerWithdrawals,
  };
}

/**
 * Extract income statement line items grouped by account.
 * Handles both simple double-entry and multi-line journal entries.
 * Returns per-account totals for each P&L section + source transactions for drill-down.
 */
export interface AccountLineItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  total: number;
  /** Source transactions that contribute to this line item (for click-to-detail) */
  transactions: Transaction[];
}

export interface IncomeStatementLineItems {
  revenue: AccountLineItem[];
  cogs: AccountLineItem[];
  opex: AccountLineItem[];
  tax: AccountLineItem[];
  interest: AccountLineItem[];
}

export function extractIncomeStatementLineItems(
  transactions: Transaction[]
): IncomeStatementLineItems {
  // Maps: accountId → { accountCode, accountName, total, transactions[] }
  const revenueMap = new Map<string, AccountLineItem>();
  const cogsMap = new Map<string, AccountLineItem>();
  const opexMap = new Map<string, AccountLineItem>();
  const taxMap = new Map<string, AccountLineItem>();
  const interestMap = new Map<string, AccountLineItem>();

  function addToMap(
    map: Map<string, AccountLineItem>,
    account: Account,
    amount: number,
    tx: Transaction
  ) {
    const existing = map.get(account.id);
    if (existing) {
      existing.total += amount;
      if (!existing.transactions.includes(tx)) existing.transactions.push(tx);
    } else {
      map.set(account.id, {
        accountId: account.id,
        accountCode: account.account_code || '',
        accountName: account.account_name,
        total: amount,
        transactions: [tx],
      });
    }
  }

  for (const t of transactions) {
    const amount = Number(t.amount);

    // --- Multi-line journal entry ---
    if (t.is_multi_line && t.journal_lines && t.journal_lines.length > 0) {
      for (const line of t.journal_lines) {
        const acc = line.account;
        if (!acc) continue;

        // Revenue: credit to REVENUE account
        if (line.credit_amount > 0 && acc.account_type === 'REVENUE') {
          addToMap(revenueMap, acc, line.credit_amount, t);
        }
        // Contra-revenue: debit to REVENUE account
        if (line.debit_amount > 0 && acc.account_type === 'REVENUE') {
          addToMap(revenueMap, acc, -line.debit_amount, t);
        }

        // Expenses: debit to EXPENSE account
        if (line.debit_amount > 0 && acc.account_type === 'EXPENSE') {
          const cat = acc.default_category;
          if (cat === 'TAX') {
            addToMap(taxMap, acc, line.debit_amount, t);
          } else if (t.category === 'FIN') {
            addToMap(interestMap, acc, line.debit_amount, t);
          } else {
            const section = resolveExpenseSection(acc);
            if (section === 'cost_of_revenue') {
              addToMap(cogsMap, acc, line.debit_amount, t);
            } else {
              addToMap(opexMap, acc, line.debit_amount, t);
            }
          }
        }
      }
      continue;
    }

    // --- Simple double-entry ---
    switch (t.category) {
      case 'EARN': {
        if (t.is_double_entry && t.credit_account?.account_type !== 'REVENUE') break;
        const acc = t.credit_account;
        if (acc) {
          addToMap(revenueMap, acc, amount, t);
        }
        break;
      }
      case 'VAR': {
        if (t.is_double_entry && t.debit_account?.account_type === 'ASSET') break;
        const acc = t.debit_account;
        if (acc) {
          const section = resolveExpenseSection(acc);
          if (section === 'operating_expense') {
            addToMap(opexMap, acc, amount, t);
          } else {
            addToMap(cogsMap, acc, amount, t);
          }
        }
        break;
      }
      case 'OPEX': {
        const acc = t.debit_account;
        if (acc) {
          const section = resolveExpenseSection(acc);
          if (section === 'cost_of_revenue') {
            addToMap(cogsMap, acc, amount, t);
          } else {
            addToMap(opexMap, acc, amount, t);
          }
        }
        break;
      }
      case 'TAX': {
        const acc = t.debit_account;
        if (acc) {
          addToMap(taxMap, acc, amount, t);
        }
        break;
      }
      case 'FIN': {
        if (t.is_double_entry && t.debit_account?.account_type === 'EXPENSE') {
          addToMap(interestMap, t.debit_account, amount, t);
        } else if (!t.is_double_entry && isInterestKeyword(t.name, t.description)) {
          // Legacy FIN — create a synthetic account entry
          addToMap(interestMap, {
            id: '__legacy_interest',
            account_code: '',
            account_name: t.description || t.name || 'Beban Bunga',
            account_type: 'EXPENSE',
            normal_balance: 'DEBIT',
            business_id: '',
            is_active: true,
            is_system: false,
            sort_order: 0,
          } as Account, amount, t);
        }
        break;
      }
    }
  }

  const toSortedArray = (map: Map<string, AccountLineItem>) =>
    Array.from(map.values())
      .filter((item) => Math.abs(item.total) > 0.001)
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode) || a.accountName.localeCompare(b.accountName));

  return {
    revenue: toSortedArray(revenueMap),
    cogs: toSortedArray(cogsMap),
    opex: toSortedArray(opexMap),
    tax: toSortedArray(taxMap),
    interest: toSortedArray(interestMap),
  };
}

// Calculate derived income statement metrics from a financial summary
export function calculateIncomeStatementMetrics(
  summary: FinancialSummary
): IncomeStatementMetrics {
  // Depreciation is included in operating expenses (PSAK 16)
  const operatingIncome = summary.grossProfit - summary.totalOpex - summary.totalDepreciation;
  const ebt = operatingIncome - summary.totalInterest;
  const grossMargin = summary.totalEarn > 0 ? (summary.grossProfit / summary.totalEarn) * 100 : 0;
  const operatingMargin = summary.totalEarn > 0 ? (operatingIncome / summary.totalEarn) * 100 : 0;
  const netMargin = summary.totalEarn > 0 ? (summary.netProfit / summary.totalEarn) * 100 : 0;

  return { operatingIncome, ebt, grossMargin, operatingMargin, netMargin };
}

/**
 * Build a map of cumulative cost per fixed-asset account from raw transactions.
 * Handles both legacy double-entry transactions and multi-line journal entries,
 * matching the logic used inside calculateBalanceSheet.
 */
export function buildFixedAssetCostMap(transactions: Transaction[]): Map<string, number> {
  const fixedAssetCosts = new Map<string, number>();
  for (const t of transactions) {
    // Legacy double-entry path
    if (t.is_double_entry) {
      const amount = Number(t.amount);
      if (t.debit_account?.account_type === 'ASSET' && t.debit_account.default_category === 'CAPEX') {
        fixedAssetCosts.set(t.debit_account.id, (fixedAssetCosts.get(t.debit_account.id) ?? 0) + amount);
      }
      if (t.credit_account?.account_type === 'ASSET' && t.credit_account.default_category === 'CAPEX') {
        fixedAssetCosts.set(t.credit_account.id, (fixedAssetCosts.get(t.credit_account.id) ?? 0) - amount);
      }
    }
    // Multi-line journal entries
    for (const line of (t.journal_lines ?? [])) {
      const acc = line.account;
      if (!acc || acc.account_type !== 'ASSET' || acc.default_category !== 'CAPEX') continue;
      const prev = fixedAssetCosts.get(acc.id) ?? 0;
      fixedAssetCosts.set(acc.id, prev + line.debit_amount - line.credit_amount);
    }
  }
  return fixedAssetCosts;
}

/**
 * Apply depreciation expense to a FinancialSummary and recalculate netProfit.
 * Called by hooks that know the accounts and period dates.
 * Returns a new summary object (does not mutate the original).
 */
export function applyDepreciationToSummary(
  summary: FinancialSummary,
  periodDepreciation: number
): FinancialSummary {
  const updated = { ...summary, totalDepreciation: periodDepreciation };
  updated.netProfit =
    updated.totalEarn -
    updated.totalOpex -
    updated.totalVar -
    updated.totalTax -
    updated.totalInterest -
    updated.totalDepreciation;
  return updated;
}

// Count transactions per category
export function calculateCategoryCounts(
  transactions: Transaction[]
): Record<TransactionCategory, number> {
  const counts: Record<TransactionCategory, number> = {
    EARN: 0, OPEX: 0, VAR: 0, CAPEX: 0, TAX: 0, FIN: 0,
  };
  transactions.forEach((t) => { counts[t.category]++; });
  return counts;
}

// Group transactions by month
export function groupTransactionsByMonth(
  transactions: Transaction[]
): MonthlyData[] {
  const monthMap = new Map<string, MonthlyData>();

  transactions.forEach((t) => {
    const date = new Date(t.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: 'short',
    }).format(date);

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthName,
        earn: 0,
        opex: 0,
        var: 0,
        capex: 0,
        tax: 0,
        fin: 0,
        interest: 0,
        netProfit: 0,
      });
    }

    const monthData = monthMap.get(monthKey)!;
    const amount = Number(t.amount);

    // Multi-line path
    if (t.is_multi_line && t.journal_lines && t.journal_lines.length > 0) {
      if (t.category === 'FIN') monthData.fin += amount;
      if (t.category === 'CAPEX') monthData.capex += amount;

      for (const line of t.journal_lines) {
        const acc = line.account;
        if (!acc) continue;
        if (line.debit_amount > 0 && acc.account_type === 'EXPENSE') {
          const cat = acc.default_category;
          if (cat === 'VAR') monthData.var += line.debit_amount;
          else if (cat === 'TAX') monthData.tax += line.debit_amount;
          else monthData.opex += line.debit_amount;
          if (t.category === 'FIN') monthData.interest += line.debit_amount;
        }
        if (line.credit_amount > 0 && acc.account_type === 'REVENUE') {
          monthData.earn += line.credit_amount;
        }
        if (line.debit_amount > 0 && acc.account_type === 'REVENUE') {
          monthData.earn -= line.debit_amount;
        }
      }
    } else {
      // Simple double-entry and legacy path
      switch (t.category) {
        case 'EARN':
          monthData.earn += amount;
          break;
        case 'OPEX':
          monthData.opex += amount;
          break;
        case 'VAR':
          // For double-entry: only count as COGS if debit account is EXPENSE type
          // If debit is ASSET (inventory purchase), skip from income statement
          if (t.is_double_entry && t.debit_account?.account_type === 'ASSET') {
            break;
          }
          monthData.var += amount;
          break;
        case 'CAPEX':
          monthData.capex += amount;
          break;
        case 'TAX':
          monthData.tax += amount;
          break;
        case 'FIN':
          monthData.fin += amount;
          // Only count FIN as interest if it debits an EXPENSE account
          if (t.is_double_entry && t.debit_account?.account_type === 'EXPENSE') {
            monthData.interest += amount;
          }
          // For legacy transactions, only count as interest with keyword heuristic
          if (!t.is_double_entry && isInterestKeyword(t.name, t.description)) {
            monthData.interest += amount;
          }
          break;
      }
    }

    monthData.netProfit =
      monthData.earn - monthData.opex - monthData.var - monthData.tax - monthData.interest;
  });

  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Calculate initial capital from first month's CAPEX transactions
 * Used for Balance Sheet equity calculation
 *
 * Logic:
 * 1. Find earliest CAPEX transaction date
 * 2. If no CAPEX exists, return 0
 * 3. Get month & year from first CAPEX
 * 4. Sum all CAPEX transactions within that same month & year
 * 5. Return sum as modal awal
 *
 * @param transactions - All transactions for the business
 * @returns Initial capital amount (sum of first month CAPEX)
 */
export function calculateInitialCapital(transactions: Transaction[]): number {
  // Filter CAPEX transactions
  // CAPEX can be identified by:
  // 1. category === 'CAPEX'
  // 2. OR debit_account_id points to a Fixed Asset account (default_category === 'CAPEX')
  const capexTransactions = transactions.filter(t => {
    // Skip deleted transactions
    if (t.deleted_at) return false;

    if (t.category === 'CAPEX') return true;

    // Check if double-entry transaction debits to a Fixed Asset account
    if (t.is_double_entry && t.debit_account) {
      return t.debit_account.account_type === 'ASSET' && t.debit_account.default_category === 'CAPEX';
    }

    return false;
  });

  // If no CAPEX transactions, modal awal = 0
  if (capexTransactions.length === 0) return 0;

  // Find earliest CAPEX date
  const sortedCapex = [...capexTransactions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const firstCapex = sortedCapex[0];
  const firstDate = new Date(firstCapex.date);
  const firstMonth = firstDate.getMonth();
  const firstYear = firstDate.getFullYear();

  // Sum all CAPEX in the same month/year as first CAPEX
  const initialCapital = capexTransactions
    .filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === firstMonth && date.getFullYear() === firstYear;
    })
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return initialCapital;
}

/**
 * Calculate total CAPEX from ALL transactions
 * Used for BusinessCard display
 *
 * @param transactions - All transactions for the business
 * @returns Total CAPEX amount (sum of all CAPEX transactions)
 */
export function calculateTotalCapex(transactions: Transaction[]): number {
  // Sum ALL CAPEX transactions (not just first month)
  return transactions
    .filter(t => {
      // Skip deleted transactions
      if (t.deleted_at) return false;

      if (t.category === 'CAPEX') return true;

      // Check if double-entry transaction debits to a non-cash ASSET (fixed asset purchase)
      if (t.is_double_entry && t.debit_account) {
        return t.debit_account.account_type === 'ASSET'
          && !isCashAccount(t.debit_account);
      }

      return false;
    })
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

// Calculate balance sheet using double-entry bookkeeping
// Capital should come from business settings (capital_investment), not calculated from transactions
export function calculateBalanceSheet(
  transactions: Transaction[],
  capital: number = 0,
  accounts?: Account[],
  reportDate?: Date
): BalanceSheetData {

  // Single-pass partition: O(n) bukan 2x O(n)
  const multiLineTransactions: Transaction[] = [];
  const doubleEntryTransactions: Transaction[] = [];
  const legacyTransactions: Transaction[] = [];
  for (const t of transactions) {
    if (t.is_multi_line) multiLineTransactions.push(t);
    else if (t.is_double_entry) doubleEntryTransactions.push(t);
    else legacyTransactions.push(t);
  }

  // Initialize totals
  let totalAssets = 0;
  let totalCash = 0;
  let totalInventory = 0;
  let totalReceivables = 0;
  let totalOtherCurrentAssets = 0;
  let totalFixedAssets = 0;
  let totalLiabilities = 0;
  let totalEquityCredit = 0; // Credits to EQUITY = suntik modal masuk
  let totalEquityDebit = 0;  // Debits to EQUITY = prive/dividen keluar
  let totalRevenue = 0;
  let totalExpenses = 0;

  // Classify an ASSET account into current vs fixed based on default_category
  function classifyAsset(
    account: { account_code: string; is_cash_equivalent?: boolean; default_category?: TransactionCategory },
    amount: number
  ) {
    if (account.is_cash_equivalent || isCashAccount(account.account_code)) {
      totalCash += amount;
    } else if (account.default_category === 'CAPEX') {
      totalFixedAssets += amount;
    } else if (account.default_category === 'VAR') {
      totalInventory += amount;
    } else if (account.default_category === 'EARN') {
      totalReceivables += amount;
    } else {
      totalOtherCurrentAssets += amount;
    }
  }

  // Process multi-line journal entries
  multiLineTransactions.forEach(transaction => {
    const lines = transaction.journal_lines ?? [];
    for (const line of lines) {
      const acc = line.account;
      if (!acc) continue;

      if (line.debit_amount > 0) {
        const amt = line.debit_amount;
        switch (acc.account_type) {
          case 'ASSET':
            totalAssets += amt;
            classifyAsset(acc, amt);
            break;
          case 'LIABILITY':
            totalLiabilities -= amt;
            break;
          case 'EQUITY':
            totalEquityDebit += amt;
            break;
          case 'EXPENSE':
            totalExpenses += amt;
            break;
          case 'REVENUE':
            totalRevenue -= amt;
            break;
        }
      }

      if (line.credit_amount > 0) {
        const amt = line.credit_amount;
        switch (acc.account_type) {
          case 'ASSET':
            totalAssets -= amt;
            classifyAsset(acc, -amt);
            break;
          case 'LIABILITY':
            totalLiabilities += amt;
            break;
          case 'EQUITY':
            totalEquityCredit += amt;
            break;
          case 'REVENUE':
            totalRevenue += amt;
            break;
          case 'EXPENSE':
            totalExpenses -= amt;
            break;
        }
      }
    }
  });

  // Process double-entry transactions
  doubleEntryTransactions.forEach(transaction => {
    const amount = Number(transaction.amount);
    const debitAccount = transaction.debit_account;
    const creditAccount = transaction.credit_account;

    // Process debit account
    if (debitAccount) {
      switch (debitAccount.account_type) {
        case 'ASSET':
          totalAssets += amount;
          classifyAsset(debitAccount, amount);
          break;
        case 'LIABILITY':
          totalLiabilities -= amount;
          break;
        case 'EQUITY':
          // Debit to EQUITY = prive / dividen / owner withdrawal
          totalEquityDebit += amount;
          break;
        case 'EXPENSE':
          totalExpenses += amount;
          break;
        case 'REVENUE':
          totalRevenue -= amount;
          break;
      }
    }

    // Process credit account
    if (creditAccount) {
      switch (creditAccount.account_type) {
        case 'ASSET':
          totalAssets -= amount;
          classifyAsset(creditAccount, -amount);
          break;
        case 'LIABILITY':
          totalLiabilities += amount;
          break;
        case 'EQUITY':
          // Credit to EQUITY = suntik modal / capital injection
          totalEquityCredit += amount;
          break;
        case 'REVENUE':
          totalRevenue += amount;
          break;
        case 'EXPENSE':
          totalExpenses -= amount;
          break;
      }
    }
  });

  // Process legacy transactions (fallback to old calculation)
  // Bug 4 fix: classify each legacy FIN by keyword heuristic instead of
  // lumping all FIN into liabilities.
  if (legacyTransactions.length > 0) {
    const summary = calculateFinancialSummary(legacyTransactions);

    // Classify legacy FIN transactions individually
    let legacyFinLiability = 0;   // net pinjaman masuk
    let legacyFinEquityIn = 0;    // modal masuk
    let legacyFinEquityOut = 0;   // prive / penarikan
    let legacyFinCashOut = 0;     // cicilan, pelunasan

    for (const t of legacyTransactions) {
      if (t.category !== 'FIN') continue;
      const amount = Number(t.amount);
      const finType = classifyLegacyFin(t.name, t.description);
      switch (finType) {
        case 'equity':
          legacyFinEquityIn += amount;
          break;
        case 'liability_in':
          legacyFinLiability += amount;
          break;
        case 'liability_out':
          legacyFinCashOut += amount;
          legacyFinEquityOut += amount;
          break;
        case 'interest':
          // Already handled by totalInterest in calculateFinancialSummary
          legacyFinCashOut += amount;
          break;
        default:
          // Unknown FIN → assume liability (conservative)
          legacyFinLiability += amount;
          break;
      }
    }

    const netFinCash = legacyFinEquityIn + legacyFinLiability - legacyFinCashOut;
    const operatingCash = summary.totalEarn - summary.totalOpex - summary.totalVar - summary.totalTax;
    const closingCash = capital + operatingCash - summary.totalCapex + netFinCash;

    totalCash += closingCash;
    totalFixedAssets += summary.totalCapex;
    totalAssets += closingCash + summary.totalCapex;
    totalLiabilities += legacyFinLiability;
    totalRevenue += summary.totalEarn;
    totalExpenses += summary.totalOpex + summary.totalVar + summary.totalTax;

    // Legacy equity: capital + detected equity injections - withdrawals
    totalEquityCredit += capital + legacyFinEquityIn;
    totalEquityDebit += legacyFinEquityOut;
  }

  // If no equity was recorded from double-entry or multi-line transactions,
  // fall back to capital parameter (from businesses.capital_investment)
  if (totalEquityCredit === 0 && totalEquityDebit === 0 && capital > 0 &&
      legacyTransactions.length === 0 && multiLineTransactions.length === 0) {
    totalEquityCredit = capital;
    totalCash += capital;
    totalAssets += capital;
  }

  // --- Depreciation (PSAK 16 / IAS 16) ---
  // Calculated on-the-fly from account metadata, not from journal entries.
  // Reduces fixed asset value (contra-asset) and retained earnings (via expense).
  let accumulatedDepreciation = 0;
  if (accounts && accounts.length > 0 && reportDate) {
    // Build a map of fixed asset account costs from the transaction totals.
    // Cost = net debit balance of each CAPEX asset account.
    const fixedAssetCosts = new Map<string, number>();
    doubleEntryTransactions.forEach(t => {
      const amount = Number(t.amount);
      if (t.debit_account?.account_type === 'ASSET' && t.debit_account.default_category === 'CAPEX') {
        fixedAssetCosts.set(t.debit_account.id, (fixedAssetCosts.get(t.debit_account.id) ?? 0) + amount);
      }
      if (t.credit_account?.account_type === 'ASSET' && t.credit_account.default_category === 'CAPEX') {
        fixedAssetCosts.set(t.credit_account.id, (fixedAssetCosts.get(t.credit_account.id) ?? 0) - amount);
      }
    });
    // Also accumulate fixed asset costs from multi-line journal lines
    multiLineTransactions.forEach(t => {
      for (const line of (t.journal_lines ?? [])) {
        const acc = line.account;
        if (!acc || acc.account_type !== 'ASSET' || acc.default_category !== 'CAPEX') continue;
        const prev = fixedAssetCosts.get(acc.id) ?? 0;
        fixedAssetCosts.set(acc.id, prev + line.debit_amount - line.credit_amount);
      }
    });

    const depSummary = calculateDepreciationSummary(
      accounts,
      (accountId) => fixedAssetCosts.get(accountId) ?? 0,
      reportDate
    );
    accumulatedDepreciation = depSummary.totalAccumulatedDepreciation;
  }

  // Calculate retained earnings (revenue - expenses - depreciation)
  // Depreciation reduces retained earnings like any other expense
  const retainedEarnings = totalRevenue - totalExpenses - accumulatedDepreciation;

  // Net equity from movements: capital injections minus withdrawals
  const netEquityMovements = totalEquityCredit - totalEquityDebit;

  const totalCurrentAssets = totalCash + totalInventory + totalReceivables + totalOtherCurrentAssets;

  // Net fixed assets = cost - accumulated depreciation
  const netFixedAssets = totalFixedAssets - accumulatedDepreciation;

  // Total assets uses net (depreciated) fixed asset value
  const adjustedTotalAssets = totalCurrentAssets + netFixedAssets;

  // Runtime balance sheet equation assertion: Assets = Liabilities + Equity
  const finalTotalEquity = netEquityMovements + retainedEarnings;
  const imbalance = Math.abs(adjustedTotalAssets - (totalLiabilities + finalTotalEquity));
  if (imbalance > 0.01) {
    console.warn(`[Accounting] Balance sheet imbalance detected: ${imbalance.toFixed(2)} (A=${adjustedTotalAssets.toFixed(2)}, L=${totalLiabilities.toFixed(2)}, E=${finalTotalEquity.toFixed(2)})`);
  }

  return {
    assets: {
      cash: totalCash,
      inventory: totalInventory,
      receivables: totalReceivables,
      otherCurrentAssets: totalOtherCurrentAssets,
      totalCurrentAssets,
      fixedAssets: totalFixedAssets,                // Nilai perolehan (cost)
      accumulatedDepreciation,                      // Akumulasi penyusutan (contra-asset)
      netFixedAssets,                               // fixedAssets - accumulatedDepreciation
      totalFixedAssets: netFixedAssets,              // Uses net value for totals
      totalAssets: adjustedTotalAssets,
    },
    liabilities: {
      loans: totalLiabilities,
      totalLiabilities: totalLiabilities,
    },
    equity: {
      capital: totalEquityCredit,           // Total modal disetor (suntik modal)
      drawings: totalEquityDebit,           // Total prive/dividen (ambil dana)
      retainedEarnings: retainedEarnings,
      totalEquity: netEquityMovements + retainedEarnings,
    },
  };
}

// Legacy cash codes — fallback only saat tidak punya akses objek Account
// (mis. data import lama yang cuma simpan kode). Prefer overload Account.
const LEGACY_CASH_CODES = ['1100', '1200'];

/**
 * Cek apakah akun adalah kas/setara kas.
 *
 * Preferred: pass objek Account — pakai flag `is_cash_equivalent` dari DB,
 * sehingga bisnis dengan kode akun custom (mis. 1101 Kas Kecil) tetap
 * terdeteksi setelah toggle di Chart of Accounts.
 *
 * Fallback: pass string kode — untuk path yang belum punya objek Account
 * di scope. Hanya cocok untuk akun default 1100/1200.
 */
function isCashAccount(account: Pick<Account, 'account_code' | 'is_cash_equivalent'>): boolean;
function isCashAccount(code: string | null | undefined): boolean;
function isCashAccount(
  arg: Pick<Account, 'account_code' | 'is_cash_equivalent'> | string | null | undefined
): boolean {
  if (arg == null) return false;
  if (typeof arg === 'string') return LEGACY_CASH_CODES.includes(arg);
  return arg.is_cash_equivalent === true;
}

/**
 * Classify a cash movement by the counter-account for cash flow statement.
 *
 * Per IAS 7 / PSAK 2, the classification depends on the *nature* of the
 * counter-account, not just its account_type:
 *
 *   - REVENUE / EXPENSE → Operating (unchanged)
 *   - ASSET:
 *       • Trade receivables (piutang usaha) → Operating
 *         (cash received from customers is an operating activity)
 *       • Other assets (fixed assets, inventory, etc.) → Investing
 *   - LIABILITY:
 *       • Trade/operating payables (hutang usaha, accrued expenses) → Operating
 *         (cash paid to suppliers/for operating obligations is operating)
 *       • Other liabilities (bank loans, long-term debt) → Financing
 *   - EQUITY → Financing (unchanged)
 */
function classifyCashFlow(
  counterAccount: Account
): 'operating' | 'investing' | 'financing' {
  const accountType = counterAccount.account_type;
  const name = (counterAccount.account_name || '').toLowerCase();
  const defaultCategory = counterAccount.default_category;

  switch (accountType) {
    case 'REVENUE':
    case 'EXPENSE':
      return 'operating';

    case 'ASSET': {
      // Trade receivables are operating (IAS 7.14 — cash received from customers)
      const isTradeReceivable =
        defaultCategory === 'EARN' ||
        name.includes('piutang usaha') ||
        name.includes('receivable');
      if (isTradeReceivable) return 'operating';

      // Advances/talangan are financing (cash paid on behalf of others, to be reimbursed)
      const isAdvanceReceivable =
        defaultCategory === 'FIN' ||
        name.includes('talangan') ||
        name.includes('advance');
      if (isAdvanceReceivable) return 'financing';

      // Other non-cash assets (fixed assets, inventory, etc.) → investing
      return 'investing';
    }

    case 'LIABILITY': {
      // Trade/operating payables are operating (IAS 7.14 — cash paid to suppliers)
      const isOperatingPayable =
        defaultCategory === 'OPEX' ||
        defaultCategory === 'VAR' ||
        defaultCategory === 'TAX' ||
        name.includes('hutang usaha') ||
        name.includes('utang usaha') ||
        name.includes('payable') ||
        name.includes('accrued');
      return isOperatingPayable ? 'operating' : 'financing';
    }

    case 'EQUITY':
      return 'financing';

    default:
      return 'operating';
  }
}

/**
 * Calculate opening balance from ALL cash movements before startDate.
 *
 * This sums every transaction that touches a cash/bank account (1100/1200)
 * before the reporting period, giving the correct cash position at period start.
 *
 * For double-entry: Dr Cash = +amount, Cr Cash = -amount.
 * For legacy: category-based (EARN +, OPEX/VAR/TAX/CAPEX -, FIN +).
 *
 * Falls back to capital_investment only when no transactions exist before the period.
 */
function calculateOpeningBalance(
  allTransactions: Transaction[],
  startDate: string,
  fallbackCapital: number
): number {
  const prePeriodTxns = allTransactions.filter(t => t.date < startDate);

  // No transactions before period → fall back to capital from business settings
  if (prePeriodTxns.length === 0) return fallbackCapital;

  let opening = 0;

  // Multi-line: sum actual cash line movements
  for (const t of prePeriodTxns) {
    if (!t.is_multi_line) continue;
    for (const line of (t.journal_lines ?? [])) {
      const acc = line.account;
      if (!acc || !isCashAccount(acc)) continue;
      opening += line.debit_amount - line.credit_amount;
    }
  }

  // Double-entry: sum net cash movements
  for (const t of prePeriodTxns) {
    if (!t.is_double_entry || t.is_multi_line) continue;

    if (!t.debit_account || !t.credit_account) continue;

    const debitIsCash = isCashAccount(t.debit_account);
    const creditIsCash = isCashAccount(t.credit_account);
    const amount = Number(t.amount);

    if (debitIsCash && !creditIsCash) {
      opening += amount;  // cash in
    } else if (!debitIsCash && creditIsCash) {
      opening -= amount;  // cash out
    }
    // Both cash (transfer between kas/bank) → net zero, skip
  }

  // Legacy: category-based cash movements
  // Bug 5 fix: FIN can be cash-in (pinjaman, modal) or cash-out (cicilan, prive, bunga)
  for (const t of prePeriodTxns) {
    if (t.is_double_entry || t.is_multi_line) continue;

    const amount = Number(t.amount);
    switch (t.category) {
      case 'EARN':
        opening += amount; break;
      case 'OPEX':
      case 'VAR':
      case 'TAX':
        opening -= amount; break;
      case 'CAPEX':
        opening -= amount; break;
      case 'FIN': {
        const finType = classifyLegacyFin(t.name, t.description);
        if (finType === 'equity' || finType === 'liability_in') {
          opening += amount;  // cash in
        } else if (finType === 'liability_out' || finType === 'interest') {
          opening -= amount;  // cash out
        } else {
          opening += amount;  // unknown → assume cash in (conservative)
        }
        break;
      }
      default:
        opening += amount;
    }
  }

  // If we only have legacy transactions and no double-entry equity transactions,
  // capital from business settings is the base (legacy didn't record capital injection)
  const hasDoubleEntryEquity = prePeriodTxns.some(t => {
    if (t.is_multi_line) {
      const lines = t.journal_lines ?? [];
      const hasCashLine = lines.some(l => l.account && isCashAccount(l.account));
      const hasEquityLine = lines.some(l => l.account?.account_type === 'EQUITY');
      return hasCashLine && hasEquityLine;
    }
    return t.is_double_entry && (
      (t.debit_account != null && isCashAccount(t.debit_account) && t.credit_account?.account_type === 'EQUITY') ||
      (t.credit_account != null && isCashAccount(t.credit_account) && t.debit_account?.account_type === 'EQUITY')
    );
  });
  const hasLegacyTxns = prePeriodTxns.some(t => !t.is_double_entry && !t.is_multi_line);

  if (hasLegacyTxns && !hasDoubleEntryEquity) {
    opening += fallbackCapital;
  }

  return opening;
}

// Calculate cash flow
export function calculateCashFlow(
  transactions: Transaction[],
  capital: number = 0,
  allTransactions?: Transaction[],
  startDate?: string,
): CashFlowData {
  const multiLineTxns = transactions.filter(t => t.is_multi_line);
  const doubleEntryTxns = transactions.filter(t => t.is_double_entry && !t.is_multi_line);
  const legacyTxns = transactions.filter(t => !t.is_double_entry && !t.is_multi_line);

  let operating = 0;
  let investing = 0;
  let financing = 0;

  const operatingTransactions: CashFlowTransaction[] = [];
  const investingTransactions: CashFlowTransaction[] = [];
  const financingTransactions: CashFlowTransaction[] = [];

  // --- Double-entry: track actual cash movement ---
  doubleEntryTxns.forEach(t => {
    const amount = Number(t.amount);
    if (!t.debit_account || !t.credit_account) return;

    const debitIsCash = isCashAccount(t.debit_account);
    const creditIsCash = isCashAccount(t.credit_account);

    // Only process transactions that touch a cash/bank account
    if (!debitIsCash && !creditIsCash) return;

    // Both sides are cash (bank transfer) → no net cash flow impact
    if (debitIsCash && creditIsCash) return;

    let cashAmount: number;
    let bucket: 'operating' | 'investing' | 'financing';

    if (debitIsCash) {
      // Cash increases (debit to cash) → money IN
      bucket = classifyCashFlow(t.credit_account!);
      cashAmount = amount;
    } else {
      // Cash decreases (credit to cash) → money OUT
      bucket = classifyCashFlow(t.debit_account!);
      cashAmount = -amount;
    }

    const entry: CashFlowTransaction = {
      id: t.id,
      date: t.date,
      name: t.name,
      description: t.description,
      amount: cashAmount,
      category: t.category,
      debitAccount: t.debit_account ? `${t.debit_account.account_code} - ${t.debit_account.account_name}` : undefined,
      creditAccount: t.credit_account ? `${t.credit_account.account_code} - ${t.credit_account.account_name}` : undefined,
    };

    if (bucket === 'operating') {
      operating += cashAmount;
      operatingTransactions.push(entry);
    } else if (bucket === 'investing') {
      investing += cashAmount;
      investingTransactions.push(entry);
    } else {
      financing += cashAmount;
      financingTransactions.push(entry);
    }
  });

  // --- Multi-line: use actual cash lines from journal_lines ---
  multiLineTxns.forEach(t => {
    const lines = t.journal_lines ?? [];
    // Compute net cash movement from cash/bank lines
    let cashIn = 0;
    let cashOut = 0;
    for (const line of lines) {
      const acc = line.account;
      if (!acc) continue;
      if (isCashAccount(acc)) {
        cashIn += line.debit_amount;
        cashOut += line.credit_amount;
      }
    }

    const netCash = cashIn - cashOut;
    if (netCash === 0) return; // Non-cash transaction (accrual)

    // Use transaction category for bucket classification
    let bucket: 'operating' | 'investing' | 'financing';
    switch (t.category) {
      case 'EARN':
        bucket = 'operating'; break;
      case 'OPEX': case 'VAR': case 'TAX':
        bucket = 'operating'; break;
      case 'CAPEX':
        bucket = 'investing'; break;
      case 'FIN':
        bucket = 'financing'; break;
      default:
        bucket = 'operating';
    }

    const entry: CashFlowTransaction = {
      id: t.id,
      date: t.date,
      name: t.name,
      description: t.description,
      amount: netCash,
      category: t.category,
    };

    if (bucket === 'operating') {
      operating += netCash;
      operatingTransactions.push(entry);
    } else if (bucket === 'investing') {
      investing += netCash;
      investingTransactions.push(entry);
    } else {
      financing += netCash;
      financingTransactions.push(entry);
    }
  });

  // --- Legacy: category-based fallback ---
  if (legacyTxns.length > 0) {
    legacyTxns.forEach(t => {
      const amount = Number(t.amount);
      let bucket: 'operating' | 'investing' | 'financing';
      let cashAmount: number;

      switch (t.category) {
        case 'EARN':
          bucket = 'operating'; cashAmount = amount; break;
        case 'OPEX':
        case 'VAR':
        case 'TAX':
          bucket = 'operating'; cashAmount = -amount; break;
        case 'CAPEX':
          bucket = 'investing'; cashAmount = -amount; break;
        case 'FIN':
          bucket = 'financing'; cashAmount = amount; break;
        default:
          bucket = 'operating'; cashAmount = amount;
      }

      const entry: CashFlowTransaction = {
        id: t.id,
        date: t.date,
        name: t.name,
        description: t.description,
        amount: cashAmount,
        category: t.category,
      };

      if (bucket === 'operating') {
        operating += cashAmount;
        operatingTransactions.push(entry);
      } else if (bucket === 'investing') {
        investing += cashAmount;
        investingTransactions.push(entry);
      } else {
        financing += cashAmount;
        financingTransactions.push(entry);
      }
    });
  }

  const netCashFlow = operating + investing + financing;
  const openingBalance = (allTransactions && startDate)
    ? calculateOpeningBalance(allTransactions, startDate, capital)
    : capital;
  const closingBalance = openingBalance + netCashFlow;

  return {
    operating,
    investing,
    financing,
    netCashFlow,
    openingBalance,
    closingBalance,
    operatingTransactions,
    investingTransactions,
    financingTransactions,
  };
}

// Calculate ROI
// Test-only exports (internal helpers exposed for unit tests).
// Do NOT consume these from app code — they may change without notice.
export const __test__ = {
  classifyLegacyFin,
  classifyCashFlow,
  isCashAccount,
  calculateOpeningBalance,
};

export function calculateROI(netProfit: number, capital: number): number {
  if (capital === 0) return 0;
  return (netProfit / capital) * 100;
}

// Average monthly ROI = total ROI divided by number of months elapsed.
// Note: this is a simple average, NOT a compound annualized rate.
// For compound annualized ROI use: (1 + roi/100)^(12/months) - 1
export function calculateAverageMonthlyROI(
  netProfit: number,
  capital: number,
  months: number = 1
): number {
  const roi = calculateROI(netProfit, capital);
  return months > 0 ? roi / months : 0;
}

// Calculate profit margin
export function calculateProfitMargin(netProfit: number, revenue: number): number {
  if (revenue === 0) return 0;
  return (netProfit / revenue) * 100;
}

// Filter transactions by date range
export function filterTransactionsByDateRange(
  transactions: Transaction[],
  startDate: string,
  endDate: string
): Transaction[] {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return transactions.filter((t) => {
    const date = new Date(t.date);
    return date >= start && date <= end;
  });
}

// Filter transactions up to a specific date (cumulative, for Balance Sheet)
export function filterTransactionsUpToDate(
  transactions: Transaction[],
  endDate: string
): Transaction[] {
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // Include entire day

  return transactions.filter((t) => {
    const date = new Date(t.date);
    return date <= end;
  });
}

// Filter transactions by category
export function filterTransactionsByCategory(
  transactions: Transaction[],
  category: TransactionCategory
): Transaction[] {
  return transactions.filter((t) => t.category === category);
}

// Get unique months from transactions
export function getUniqueMonths(transactions: Transaction[]): string[] {
  const months = new Set<string>();

  transactions.forEach((t) => {
    const date = new Date(t.date);
    const monthKey = new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: 'long',
    }).format(date);
    months.add(monthKey);
  });

  return Array.from(months).sort();
}

// ==================== BUDGET & FORECAST CALCULATIONS ====================

/**
 * Compute actual amounts per account per month from posted transactions.
 * For each transaction, the amount is attributed to the debit and credit accounts.
 * The returned value per account follows its normal_balance convention:
 * - DEBIT normal_balance accounts: sum of debits - sum of credits
 * - CREDIT normal_balance accounts: sum of credits - sum of debits
 *
 * Returns Map keyed by `${accountId}:${YYYY-MM}` with the net amount.
 */
export function computeActualsByAccountAndMonth(
  transactions: Transaction[],
  accounts: Account[]
): Map<string, number> {
  const accountMap = new Map<string, Account>();
  accounts.forEach((a) => accountMap.set(a.id, a));

  // Track debit/credit sides separately per account+month
  const debits = new Map<string, number>();
  const credits = new Map<string, number>();

  const posted = transactions.filter((t) => t.status === 'posted');

  posted.forEach((t) => {
    const monthKey = t.date.substring(0, 7); // YYYY-MM

    if (t.debit_account_id) {
      const key = `${t.debit_account_id}:${monthKey}`;
      debits.set(key, (debits.get(key) || 0) + t.amount);
    }
    if (t.credit_account_id) {
      const key = `${t.credit_account_id}:${monthKey}`;
      credits.set(key, (credits.get(key) || 0) + t.amount);
    }
  });

  // Combine based on normal_balance
  const result = new Map<string, number>();
  const allKeys = new Set([...debits.keys(), ...credits.keys()]);

  allKeys.forEach((key) => {
    const accountId = key.split(':')[0];
    const account = accountMap.get(accountId);
    if (!account) return;

    const debitTotal = debits.get(key) || 0;
    const creditTotal = credits.get(key) || 0;

    // For DEBIT normal_balance (ASSET, EXPENSE): actual = debits - credits
    // For CREDIT normal_balance (LIABILITY, EQUITY, REVENUE): actual = credits - debits
    const actual = account.normal_balance === 'DEBIT'
      ? debitTotal - creditTotal
      : creditTotal - debitTotal;

    if (actual !== 0) {
      result.set(key, actual);
    }
  });

  return result;
}

/**
 * Compare budget lines against actual transactions to produce variance rows.
 * Variance semantics:
 * - Revenue accounts: positive variance = favorable (actual > budget)
 * - Expense accounts: negative variance = favorable (actual < budget)
 */
export function calculateBudgetVsActual(
  budgetLines: BudgetLine[],
  transactions: Transaction[],
  accounts: Account[]
): BudgetVsActualRow[] {
  const actuals = computeActualsByAccountAndMonth(transactions, accounts);
  const accountMap = new Map<string, Account>();
  accounts.forEach((a) => accountMap.set(a.id, a));

  return budgetLines.map((line) => {
    const account = line.account || accountMap.get(line.account_id);
    const monthKey = line.month.substring(0, 7); // YYYY-MM
    const actualKey = `${line.account_id}:${monthKey}`;
    const actual = actuals.get(actualKey) || 0;
    const budgeted = line.amount;

    // For revenue: variance = actual - budgeted (positive = good)
    // For expense: variance = budgeted - actual (positive = good, under budget)
    const isRevenue = account?.account_type === 'REVENUE';
    const variance = isRevenue
      ? actual - budgeted
      : budgeted - actual;
    const variancePercent = budgeted !== 0
      ? (variance / budgeted) * 100
      : actual === 0 ? 0 : (isRevenue ? 100 : -100);

    return {
      accountId: line.account_id,
      accountCode: account?.account_code || '',
      accountName: account?.account_name || '',
      accountType: account?.account_type || 'EXPENSE',
      month: monthKey,
      budgeted,
      actual,
      variance,
      variancePercent,
    };
  });
}

/**
 * Compute summary KPIs for a budget period.
 */
export function calculateBudgetSummaryKPI(
  rows: BudgetVsActualRow[],
  budget: Budget
): BudgetSummaryKPI {
  let totalBudgetedRevenue = 0;
  let totalActualRevenue = 0;
  let totalBudgetedExpense = 0;
  let totalActualExpense = 0;

  rows.forEach((row) => {
    if (row.accountType === 'REVENUE') {
      totalBudgetedRevenue += row.budgeted;
      totalActualRevenue += row.actual;
    } else {
      totalBudgetedExpense += row.budgeted;
      totalActualExpense += row.actual;
    }
  });

  const revenueVariance = totalActualRevenue - totalBudgetedRevenue;
  const expenseVariance = totalBudgetedExpense - totalActualExpense;

  const revenueVariancePercent = totalBudgetedRevenue !== 0
    ? (revenueVariance / totalBudgetedRevenue) * 100
    : 0;
  const expenseVariancePercent = totalBudgetedExpense !== 0
    ? (expenseVariance / totalBudgetedExpense) * 100
    : 0;

  // Calculate months elapsed and remaining
  const now = new Date();
  const start = new Date(budget.start_date);
  const end = new Date(budget.end_date);
  const totalMonths = Math.max(1,
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
  );
  const monthsElapsed = Math.max(1, Math.min(totalMonths,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1
  ));
  const monthsRemaining = Math.max(0, totalMonths - monthsElapsed);

  const burnRate = totalActualExpense / monthsElapsed;
  const totalBudget = totalBudgetedRevenue + totalBudgetedExpense;
  const totalActual = totalActualRevenue + totalActualExpense;
  const budgetUtilization = totalBudget !== 0
    ? (totalActual / totalBudget) * 100
    : 0;

  return {
    totalBudgetedRevenue,
    totalActualRevenue,
    totalBudgetedExpense,
    totalActualExpense,
    revenueVariance,
    expenseVariance,
    revenueVariancePercent,
    expenseVariancePercent,
    burnRate,
    monthsRemaining,
    budgetUtilization,
  };
}

/**
 * Project future months based on historical trend + budget targets.
 * Past months use actual data. Future months use budget target weighted by
 * the historical actual/budget ratio (trend factor).
 */
export function projectBudgetTrend(
  budgetLines: BudgetLine[],
  transactions: Transaction[],
  accounts: Account[],
  projectionMonths: number
): ProjectedMonth[] {
  const actuals = computeActualsByAccountAndMonth(transactions, accounts);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Aggregate budget lines by month (total budgeted per month)
  const budgetByMonth = new Map<string, number>();
  budgetLines.forEach((line) => {
    const monthKey = line.month.substring(0, 7);
    budgetByMonth.set(monthKey, (budgetByMonth.get(monthKey) || 0) + line.amount);
  });

  // Aggregate actuals by month (sum absolute actuals across all budgeted accounts)
  const actualByMonth = new Map<string, number>();
  const budgetedAccountIds = new Set(budgetLines.map((l) => l.account_id));
  actuals.forEach((amount, key) => {
    const [accountId, monthKey] = key.split(':');
    if (budgetedAccountIds.has(accountId)) {
      actualByMonth.set(monthKey, (actualByMonth.get(monthKey) || 0) + Math.abs(amount));
    }
  });

  // Calculate trend factor: average (actual / budget) for past months
  let ratioSum = 0;
  let ratioCount = 0;
  budgetByMonth.forEach((budgeted, month) => {
    if (month < currentMonth && budgeted > 0) {
      const actual = actualByMonth.get(month) || 0;
      ratioSum += actual / budgeted;
      ratioCount++;
    }
  });
  const trendFactor = ratioCount > 0 ? ratioSum / ratioCount : 1;

  // Build projection data: all budget months + future projection months
  const allMonths = Array.from(budgetByMonth.keys()).sort();

  // Add future months beyond budget period if needed
  const lastBudgetMonth = allMonths[allMonths.length - 1];
  if (lastBudgetMonth) {
    const [lastYear, lastMon] = lastBudgetMonth.split('-').map(Number);
    let y = lastYear;
    let m = lastMon;
    for (let i = 0; i < projectionMonths; i++) {
      m++;
      if (m > 12) { m = 1; y++; }
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (!allMonths.includes(key)) {
        allMonths.push(key);
      }
    }
  }

  return allMonths.map((month) => {
    const budgeted = budgetByMonth.get(month) || 0;
    const actual = actualByMonth.get(month) || 0;
    const isPast = month < currentMonth;
    const isCurrent = month === currentMonth;

    let projected: number;
    if (isPast) {
      projected = actual; // past: projected = actual
    } else if (isCurrent) {
      // Current month: blend actual progress with budget
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const progress = dayOfMonth / daysInMonth;
      projected = actual + (budgeted * trendFactor - actual) * (1 - progress);
    } else {
      // Future: budget target × trend factor
      projected = budgeted > 0 ? budgeted * trendFactor : budgeted;
    }

    return { month, budgeted, actual, projected };
  });
}
