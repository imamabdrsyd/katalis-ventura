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
    summary.totalCapex -
    summary.totalTax;

  return summary;
}

// Calculate derived income statement metrics from a financial summary
export function calculateIncomeStatementMetrics(
  summary: FinancialSummary
): IncomeStatementMetrics {
  const operatingIncome = summary.grossProfit - summary.totalOpex;
  const ebit = operatingIncome - summary.totalCapex;
  const ebt = ebit - summary.totalFin;
  const grossMargin = summary.totalEarn > 0 ? (summary.grossProfit / summary.totalEarn) * 100 : 0;
  const operatingMargin = summary.totalEarn > 0 ? (operatingIncome / summary.totalEarn) * 100 : 0;
  const netMargin = summary.totalEarn > 0 ? (summary.netProfit / summary.totalEarn) * 100 : 0;

  return { operatingIncome, ebit, ebt, grossMargin, operatingMargin, netMargin };
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
      monthData.earn - monthData.opex - monthData.var - monthData.capex - monthData.tax;
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
          // Track cash separately (accounts 1110-1199)
          if (debitAccount.account_code >= '1110' && debitAccount.account_code < '1200') {
            totalCash += amount;
          }
          // Track property separately (accounts 1200-1299)
          if (debitAccount.account_code >= '1200' && debitAccount.account_code < '1300') {
            totalProperty += amount;
          }
          break;
        case 'LIABILITY':
          // Debit to liability decreases it
          totalLiabilities -= amount;
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
          if (creditAccount.account_code >= '1110' && creditAccount.account_code < '1200') {
            totalCash -= amount;
          }
          // Track property separately
          if (creditAccount.account_code >= '1200' && creditAccount.account_code < '1300') {
            totalProperty -= amount;
          }
          break;
        case 'LIABILITY':
          // Credit to liability increases it
          totalLiabilities += amount;
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
    totalLiabilities += Math.abs(summary.totalFin);
    totalRevenue += summary.totalEarn;
    totalExpenses += summary.totalOpex + summary.totalVar + summary.totalTax;
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
      capital: capital,
      retainedEarnings: retainedEarnings,
      totalEquity: capital + retainedEarnings,
    },
  };
}

// Calculate cash flow
// Capital should come from business settings (capital_investment)
export function calculateCashFlow(
  transactions: Transaction[],
  capital: number = 0
): CashFlowData {
  const summary = calculateFinancialSummary(transactions);

  const operating =
    summary.totalEarn - summary.totalOpex - summary.totalVar - summary.totalTax;
  const investing = -summary.totalCapex;
  const financing = summary.totalFin;

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
