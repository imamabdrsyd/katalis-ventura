import type {
  Transaction,
  TransactionCategory,
  FinancialSummary,
  IncomeStatementMetrics,
  MonthlyData,
  BalanceSheetData,
  CashFlowData,
} from '@/types';

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
  EARN: '#10b981', // green
  OPEX: '#ef4444', // red
  VAR: '#f59e0b', // amber
  CAPEX: '#6366f1', // indigo
  TAX: '#8b5cf6', // purple
  FIN: '#ec4899', // pink
};

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
    netProfit: 0,
    grossProfit: 0,
  };

  transactions.forEach((t) => {
    const amount = Number(t.amount);
    switch (t.category) {
      case 'EARN':
        summary.totalEarn += amount;
        break;
      case 'OPEX':
        summary.totalOpex += amount;
        break;
      case 'VAR':
        summary.totalVar += amount;
        break;
      case 'CAPEX':
        summary.totalCapex += amount;
        break;
      case 'TAX':
        summary.totalTax += amount;
        break;
      case 'FIN':
        summary.totalFin += amount;
        break;
    }
  });

  summary.grossProfit = summary.totalEarn - summary.totalVar;
  summary.netProfit =
    summary.totalEarn -
    summary.totalOpex -
    summary.totalVar -
    summary.totalTax -
    summary.totalFin;

  return summary;
}

// Calculate derived income statement metrics from a financial summary
export function calculateIncomeStatementMetrics(
  summary: FinancialSummary
): IncomeStatementMetrics {
  const operatingIncome = summary.grossProfit - summary.totalOpex;
  const ebt = operatingIncome - summary.totalFin;
  const grossMargin = summary.totalEarn > 0 ? (summary.grossProfit / summary.totalEarn) * 100 : 0;
  const operatingMargin = summary.totalEarn > 0 ? (operatingIncome / summary.totalEarn) * 100 : 0;
  const netMargin = summary.totalEarn > 0 ? (summary.netProfit / summary.totalEarn) * 100 : 0;

  return { operatingIncome, ebt, grossMargin, operatingMargin, netMargin };
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
        netProfit: 0,
      });
    }

    const monthData = monthMap.get(monthKey)!;
    const amount = Number(t.amount);

    switch (t.category) {
      case 'EARN':
        monthData.earn += amount;
        break;
      case 'OPEX':
        monthData.opex += amount;
        break;
      case 'VAR':
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
        break;
    }

    monthData.netProfit =
      monthData.earn - monthData.opex - monthData.var - monthData.tax - monthData.fin;
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
  // 2. OR debit_account_id points to Fixed Assets (codes 1200-1299)
  const capexTransactions = transactions.filter(t => {
    // Skip deleted transactions
    if (t.deleted_at) return false;

    if (t.category === 'CAPEX') return true;

    // Check if double-entry transaction debits to Fixed Assets
    if (t.is_double_entry && t.debit_account) {
      const accountCode = t.debit_account.account_code;
      return accountCode >= '1200' && accountCode < '1300';
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

      // Check if double-entry transaction debits to Fixed Assets
      if (t.is_double_entry && t.debit_account) {
        const code = t.debit_account.account_code;
        return code >= '1200' && code < '1300';
      }

      return false;
    })
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

// Calculate balance sheet using double-entry bookkeeping
// Capital should come from business settings (capital_investment), not calculated from transactions
export function calculateBalanceSheet(
  transactions: Transaction[],
  capital: number = 0
): BalanceSheetData {

  // Separate double-entry and legacy transactions
  const doubleEntryTransactions = transactions.filter(t => t.is_double_entry);
  const legacyTransactions = transactions.filter(t => !t.is_double_entry);

  // Initialize totals
  let totalAssets = 0;
  let totalCash = 0;
  let totalProperty = 0;
  let totalLiabilities = 0;
  let totalEquity = 0; // NEW: Track equity from transactions
  let totalRevenue = 0;
  let totalExpenses = 0;

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
          // Track cash separately (Cash: 1100, Bank: 1200)
          if (debitAccount.account_code === '1100' || debitAccount.account_code === '1200') {
            totalCash += amount;
          }
          // Track property separately (Fixed Assets: 1200-1299 range, excluding Bank at 1200)
          const debitCode = parseInt(debitAccount.account_code);
          if (debitCode > 1200 && debitCode < 1300) {
            totalProperty += amount;
          }
          break;
        case 'LIABILITY':
          // Debit to liability decreases it
          totalLiabilities -= amount;
          break;
        case 'EQUITY':
          // Debit to equity decreases it (withdrawals, distributions)
          totalEquity -= amount;
          break;
        case 'EXPENSE':
          totalExpenses += amount;
          break;
      }
    }

    // Process credit account
    if (creditAccount) {
      switch (creditAccount.account_type) {
        case 'ASSET':
          totalAssets -= amount;
          // Track cash separately
          if (creditAccount.account_code === '1100' || creditAccount.account_code === '1200') {
            totalCash -= amount;
          }
          // Track property separately (Fixed Assets: 1200-1299 range, excluding Bank at 1200)
          const creditCode = parseInt(creditAccount.account_code);
          if (creditCode > 1200 && creditCode < 1300) {
            totalProperty -= amount;
          }
          break;
        case 'LIABILITY':
          // Credit to liability increases it
          totalLiabilities += amount;
          break;
        case 'EQUITY':
          // Credit to equity increases it (capital investment, contributions)
          totalEquity += amount;
          break;
        case 'REVENUE':
          totalRevenue += amount;
          break;
      }
    }
  });

  // Process legacy transactions (fallback to old calculation)
  // For legacy transactions, calculate cash flow starting from capital as opening balance
  if (legacyTransactions.length > 0) {
    const summary = calculateFinancialSummary(legacyTransactions);

    // Cash flow calculation:
    // Opening: capital (from business settings)
    // + Operating: earn - opex - var - tax
    // - Investing: capex (becomes property)
    // + Financing: financing transactions
    const operatingCash = summary.totalEarn - summary.totalOpex - summary.totalVar - summary.totalTax;
    const closingCash = capital + operatingCash - summary.totalCapex + summary.totalFin;

    totalCash += closingCash;
    totalProperty += summary.totalCapex;
    totalAssets += closingCash + summary.totalCapex;
    totalLiabilities += summary.totalFin;
    totalRevenue += summary.totalEarn;
    totalExpenses += summary.totalOpex + summary.totalVar + summary.totalTax;

    // Add legacy capital to equity (for backward compatibility)
    totalEquity += capital;
  }

  // If no equity was recorded from double-entry transactions,
  // fall back to capital parameter (from businesses.capital_investment)
  // This handles businesses created before double-entry was implemented
  if (totalEquity === 0 && capital > 0 && legacyTransactions.length === 0) {
    totalEquity = capital;
    // Also add capital to assets (cash) for balance
    totalCash += capital;
    totalAssets += capital;
  }

  // Calculate retained earnings (revenue - expenses)
  const retainedEarnings = totalRevenue - totalExpenses;

  return {
    assets: {
      cash: totalCash,
      propertyValue: totalProperty,
      totalAssets: totalAssets,
    },
    liabilities: {
      loans: totalLiabilities,
      totalLiabilities: totalLiabilities,
    },
    equity: {
      capital: totalEquity,
      retainedEarnings: retainedEarnings,
      totalEquity: totalEquity + retainedEarnings,
    },
  };
}

// Cash account codes used as the basis for cash flow tracking
const CASH_ACCOUNT_CODES = ['1100', '1200'];

function isCashAccount(code: string): boolean {
  return CASH_ACCOUNT_CODES.includes(code);
}

/**
 * Classify a cash movement by the counter-account's type.
 *   - Revenue / Expense counter → Operating
 *   - Asset (non-cash) counter  → Investing
 *   - Liability / Equity counter → Financing
 */
function classifyCashFlow(
  counterAccountType: string
): 'operating' | 'investing' | 'financing' {
  switch (counterAccountType) {
    case 'REVENUE':
    case 'EXPENSE':
      return 'operating';
    case 'ASSET':
      return 'investing';
    case 'LIABILITY':
    case 'EQUITY':
      return 'financing';
    default:
      return 'operating';
  }
}

// Calculate cash flow
// Capital should come from business settings (capital_investment)
export function calculateCashFlow(
  transactions: Transaction[],
  capital: number = 0
): CashFlowData {
  const doubleEntryTxns = transactions.filter(t => t.is_double_entry);
  const legacyTxns = transactions.filter(t => !t.is_double_entry);

  let operating = 0;
  let investing = 0;
  let financing = 0;

  // --- Double-entry: track actual cash movement ---
  doubleEntryTxns.forEach(t => {
    const amount = Number(t.amount);
    const debitCode = t.debit_account?.account_code;
    const creditCode = t.credit_account?.account_code;

    if (!debitCode || !creditCode) return;

    const debitIsCash = isCashAccount(debitCode);
    const creditIsCash = isCashAccount(creditCode);

    // Only process transactions that touch a cash/bank account
    if (!debitIsCash && !creditIsCash) return;

    // Both sides are cash (bank transfer) → no net cash flow impact
    if (debitIsCash && creditIsCash) return;

    if (debitIsCash) {
      // Cash increases (debit to cash) → money IN
      const bucket = classifyCashFlow(t.credit_account!.account_type);
      if (bucket === 'operating') operating += amount;
      else if (bucket === 'investing') investing += amount;
      else financing += amount;
    } else {
      // Cash decreases (credit to cash) → money OUT
      const bucket = classifyCashFlow(t.debit_account!.account_type);
      if (bucket === 'operating') operating -= amount;
      else if (bucket === 'investing') investing -= amount;
      else financing -= amount;
    }
  });

  // --- Legacy: category-based fallback ---
  if (legacyTxns.length > 0) {
    const summary = calculateFinancialSummary(legacyTxns);
    operating += summary.totalEarn - summary.totalOpex - summary.totalVar - summary.totalTax;
    investing += -summary.totalCapex;
    financing += summary.totalFin;
  }

  const netCashFlow = operating + investing + financing;
  const openingBalance = capital;
  const closingBalance = openingBalance + netCashFlow;

  return {
    operating,
    investing,
    financing,
    netCashFlow,
    openingBalance,
    closingBalance,
  };
}

// Calculate ROI
export function calculateROI(netProfit: number, capital: number): number {
  if (capital === 0) return 0;
  return (netProfit / capital) * 100;
}

// Calculate monthly ROI
export function calculateMonthlyROI(
  netProfit: number,
  capital: number,
  months: number = 1
): number {
  const roi = calculateROI(netProfit, capital);
  return roi / months;
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
