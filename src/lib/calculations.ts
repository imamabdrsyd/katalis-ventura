import type {
  Transaction,
  TransactionCategory,
  FinancialSummary,
  MonthlyData,
  BalanceSheetData,
  CashFlowData,
} from '@/types';

// Constants
export const CAPITAL = 350_000_000; // Default capital investment
export const PROPERTY_VALUE = 350_000_000; // Initial property value

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  EARN: 'Earnings',
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

// Calculate balance sheet
export function calculateBalanceSheet(
  transactions: Transaction[],
  capital: number = CAPITAL
): BalanceSheetData {
  const summary = calculateFinancialSummary(transactions);
  const cashFlow = calculateCashFlow(transactions, capital);

  return {
    assets: {
      cash: cashFlow.closingBalance,
      propertyValue: PROPERTY_VALUE,
      totalAssets: cashFlow.closingBalance + PROPERTY_VALUE,
    },
    liabilities: {
      loans: Math.abs(summary.totalFin),
      totalLiabilities: Math.abs(summary.totalFin),
    },
    equity: {
      capital: capital,
      retainedEarnings: summary.netProfit,
      totalEquity: capital + summary.netProfit,
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
