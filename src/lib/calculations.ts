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
    totalInterest: 0,
    totalDepreciation: 0, // Set by hooks via applyDepreciationToSummary()
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
        // For double-entry: only count as COGS if debit account is EXPENSE type
        // If debit is ASSET (inventory purchase), it's not COGS yet — still on balance sheet
        if (t.is_double_entry && t.debit_account?.account_type === 'ASSET') {
          // Inventory purchase — skip from income statement COGS
          break;
        }
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
        // Only count FIN as interest expense if it debits an EXPENSE account
        // (interest payments). FIN that touches EQUITY/LIABILITY (capital injection,
        // loan received, loan repayment) should NOT be in income statement.
        if (t.is_double_entry && t.debit_account?.account_type === 'EXPENSE') {
          summary.totalInterest += amount;
        }
        // For legacy transactions, include in totalInterest (backward compatibility)
        if (!t.is_double_entry) {
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
        // For legacy transactions, include in interest (backward compatibility)
        if (!t.is_double_entry) {
          monthData.interest += amount;
        }
        break;
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

      // Check if double-entry transaction debits to a non-cash ASSET (fixed asset purchase)
      if (t.is_double_entry && t.debit_account) {
        return t.debit_account.account_type === 'ASSET'
          && t.debit_account.account_code !== '1100'
          && t.debit_account.account_code !== '1200';
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
  const doubleEntryTransactions: Transaction[] = [];
  const legacyTransactions: Transaction[] = [];
  for (const t of transactions) {
    if (t.is_double_entry) doubleEntryTransactions.push(t);
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
  function classifyAsset(account: { account_code: string; default_category?: TransactionCategory }, amount: number) {
    const code = account.account_code;
    if (code === '1100' || code === '1200') {
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
  if (legacyTransactions.length > 0) {
    const summary = calculateFinancialSummary(legacyTransactions);

    const operatingCash = summary.totalEarn - summary.totalOpex - summary.totalVar - summary.totalTax;
    const closingCash = capital + operatingCash - summary.totalCapex + summary.totalFin;

    totalCash += closingCash;
    totalFixedAssets += summary.totalCapex;
    totalAssets += closingCash + summary.totalCapex;
    totalLiabilities += summary.totalFin;
    totalRevenue += summary.totalEarn;
    totalExpenses += summary.totalOpex + summary.totalVar + summary.totalTax;

    // Legacy: lump capital into equity credit (no drawings distinction possible)
    totalEquityCredit += capital;
  }

  // If no equity was recorded from double-entry transactions,
  // fall back to capital parameter (from businesses.capital_investment)
  if (totalEquityCredit === 0 && totalEquityDebit === 0 && capital > 0 && legacyTransactions.length === 0) {
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

// Cash account codes used as the basis for cash flow tracking
const CASH_ACCOUNT_CODES = ['1100', '1200'];

function isCashAccount(code: string): boolean {
  return CASH_ACCOUNT_CODES.includes(code);
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
        name.includes('piutang') ||
        name.includes('receivable');
      return isTradeReceivable ? 'operating' : 'investing';
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
 * Calculate opening balance from equity transactions (Dr Cash / Cr EQUITY)
 * that occurred strictly before the given startDate.
 * Falls back to capital_investment if no equity transactions exist at all.
 */
function calculateOpeningBalance(
  allTransactions: Transaction[],
  startDate: string,
  fallbackCapital: number
): number {
  const equityTxnsBefore = allTransactions.filter(t => {
    if (!t.is_double_entry) return false;
    if (t.date >= startDate) return false;
    const debitCode = t.debit_account?.account_code;
    const creditCode = t.credit_account?.account_code;
    if (!debitCode || !creditCode) return false;
    // Dr Cash / Cr EQUITY → capital injection (money IN)
    if (isCashAccount(debitCode) && t.credit_account?.account_type === 'EQUITY') return true;
    // Dr EQUITY / Cr Cash → owner withdrawal (money OUT)
    if (isCashAccount(creditCode) && t.debit_account?.account_type === 'EQUITY') return true;
    return false;
  });

  // If no equity transactions exist at all (all-time), fall back to capital_investment
  const hasAnyEquityTxn = allTransactions.some(
    t => t.is_double_entry && (
      (t.credit_account?.account_type === 'EQUITY' && isCashAccount(t.debit_account?.account_code ?? '')) ||
      (t.debit_account?.account_type === 'EQUITY' && isCashAccount(t.credit_account?.account_code ?? ''))
    )
  );
  if (!hasAnyEquityTxn) return fallbackCapital;

  return equityTxnsBefore.reduce((sum, t) => {
    const amount = Number(t.amount);
    const debitCode = t.debit_account?.account_code ?? '';
    // Dr Cash / Cr EQUITY → cash in (+)
    if (isCashAccount(debitCode)) return sum + amount;
    // Dr EQUITY / Cr Cash → cash out (-)
    return sum - amount;
  }, 0);
}

// Calculate cash flow
export function calculateCashFlow(
  transactions: Transaction[],
  capital: number = 0,
  allTransactions?: Transaction[],
  startDate?: string,
): CashFlowData {
  const doubleEntryTxns = transactions.filter(t => t.is_double_entry);
  const legacyTxns = transactions.filter(t => !t.is_double_entry);

  let operating = 0;
  let investing = 0;
  let financing = 0;

  const operatingTransactions: CashFlowTransaction[] = [];
  const investingTransactions: CashFlowTransaction[] = [];
  const financingTransactions: CashFlowTransaction[] = [];

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
