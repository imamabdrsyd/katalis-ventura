import type {
  Transaction,
  TransactionCategory,
  FinancialSummary,
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

// Calculate balance sheet using double-entry bookkeeping
export function calculateBalanceSheet(
  transactions: Transaction[],
  capital: number = CAPITAL
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
  if (legacyTransactions.length > 0) {
    const summary = calculateFinancialSummary(legacyTransactions);
    const cashFlow = calculateCashFlow(legacyTransactions, 0);

    totalCash += cashFlow.closingBalance;
    totalProperty += summary.totalCapex;
    totalAssets += cashFlow.closingBalance + summary.totalCapex;
    totalLiabilities += Math.abs(summary.totalFin);
    totalRevenue += summary.totalEarn;
    totalExpenses += summary.totalOpex + summary.totalVar + summary.totalTax + summary.totalCapex;
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
export function calculateCashFlow(
  transactions: Transaction[],
  capital: number = CAPITAL
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
